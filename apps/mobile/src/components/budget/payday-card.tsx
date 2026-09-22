import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatCents, formatCentsCompact } from '@own-my-budget/core';

import { parseDollarsToCents, centsToInputText } from '@/components/budget/amount-input';
import { formatPayday } from '@/components/budget/format';
import type { PaydayCardData, PaymentTarget } from '@/components/budget/use-budget-data';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface PaydayCardProps {
  payday: PaydayCardData;
  /** Everything that could be assigned to a payday. */
  targets: PaymentTarget[];
  onAssign: (target: PaymentTarget, cents: number) => Promise<void>;
  onRemove: (assignmentId: string) => void;
}

/** One upcoming paycheck: expected amount, what's assigned to it, what's left, and the tools to change that. */
export function PaydayCard({ payday, targets, onAssign, onRemove }: PaydayCardProps) {
  const theme = useTheme();
  const [isAssigning, setIsAssigning] = useState(false);
  const [selected, setSelected] = useState<PaymentTarget | null>(null);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const available = useMemo(
    () =>
      targets.filter(
        (t) => !payday.items.some((i) => i.targetType === t.type && i.targetId === t.id)
      ),
    [targets, payday.items]
  );
  const dateLabel = formatPayday(payday.payDate);
  const remainingLabel = payday.isOverAssigned
    ? `${formatCents(-payday.remainingCents)} over`
    : `${formatCents(payday.remainingCents)} left`;

  function chooseTarget(target: PaymentTarget) {
    setSelected(target);
    setAmount(target.suggestedCents > 0 ? centsToInputText(target.suggestedCents) : '');
    setFormError(null);
  }

  function closeForm() {
    setIsAssigning(false);
    setSelected(null);
    setAmount('');
    setFormError(null);
  }

  async function save() {
    if (!selected) return;
    const cents = parseDollarsToCents(amount);
    if (cents === null || cents <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    setIsSaving(true);
    try {
      await onAssign(selected, cents);
      closeForm();
    } catch {
      setFormError("Couldn't save that. Try again in a moment.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card
      style={{
        gap: Space[3],
        borderWidth: 1.5,
        borderColor: theme.border,
        borderRadius: Radius.card,
        padding: Space[5],
        shadowOpacity: 0,
        elevation: 0,
        boxShadow: 'none',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: Space[3],
        }}
      >
        <View style={{ flexShrink: 1, gap: 2 }}>
          <ThemedText type="smallBold" style={{ fontSize: 17, lineHeight: 24 }}>
            {dateLabel} · {payday.sourceLabel}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {payday.personLabel ? `${payday.personLabel} · expected` : 'Expected'}{' '}
            {formatCents(payday.expectedCents)}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <ThemedText type="amountSmall" themeColor={payday.isOverAssigned ? 'warning' : 'success'}>
            {remainingLabel}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatCents(payday.assignedCents)} assigned · {payday.items.length} payment(s)
          </ThemedText>
        </View>
      </View>

      {payday.isOverAssigned ? (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: theme.warningMuted,
            borderRadius: Radius.input,
            paddingVertical: Space[3],
            paddingHorizontal: Space[4],
          }}
        >
          <ThemedText type="smallBold" themeColor="warning">
            ⚠ Assigned payments exceed this paycheck — you may want to move one to another payday.
          </ThemedText>
        </View>
      ) : null}

      {payday.items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No payments assigned yet.
        </ThemedText>
      ) : (
        <View>
          {payday.items.map((item) => (
            <View
              key={item.assignmentId}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: Space[2],
                paddingVertical: Space[2],
                borderTopWidth: 1,
                borderTopColor: theme.border,
              }}
            >
              <View style={{ flexShrink: 1, flexBasis: 160, flexGrow: 1 }}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.typeLabel}
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
                <ThemedText type="smallBold">{formatCentsCompact(item.amountCents)}</ThemedText>
                <Button
                  label="Remove"
                  variant="dangerQuiet"
                  size="sm"
                  accessibilityLabel={`Remove ${item.name} from the ${dateLabel} paycheck`}
                  onPress={() => onRemove(item.assignmentId)}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {isAssigning ? (
        <View style={{ gap: Space[3] }}>
          <ThemedText type="smallBold">Assign a payment to this paycheck</ThemedText>
          {available.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing left to assign — add a bill, debt, or savings goal first.
            </ThemedText>
          ) : (
            <SelectField
              label="Payment"
              placeholder="Choose a bill, debt, or goal"
              value={selected ? `${selected.type}:${selected.id}` : ''}
              options={available.map((target) => ({
                value: `${target.type}:${target.id}`,
                label: `${target.name} — ${target.typeLabel}`,
              }))}
              onChange={(value) => {
                const target = available.find((t) => `${t.type}:${t.id}` === value);
                if (target) chooseTarget(target);
              }}
            />
          )}
          {selected ? (
            <TextField
              label={`Amount for ${selected.name}`}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              errorMessage={formError ?? undefined}
            />
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            <Button
              label="Assign"
              accessibilityLabel={`Assign the selected payment to the ${dateLabel} ${payday.sourceLabel} paycheck`}
              size="sm"
              shape="rounded"
              loading={isSaving}
              disabled={!selected || isSaving}
              onPress={save}
            />
            <Button label="Cancel" variant="soft" size="sm" shape="rounded" onPress={closeForm} />
          </View>
        </View>
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label="+ Assign payment"
            variant="soft"
            size="sm"
            shape="rounded"
            accessibilityLabel={`Assign a payment to the ${dateLabel} ${payday.sourceLabel} paycheck`}
            onPress={() => setIsAssigning(true)}
          />
        </View>
      )}
    </Card>
  );
}
