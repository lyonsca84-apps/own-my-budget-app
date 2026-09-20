import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  listBillsWithPayments,
  listDebtsWithPayments,
  listIncomeSources,
  listPaydayAssignments,
  replacePaydayPlan,
} from '@own-my-budget/api';
import {
  formatCents,
  parseLocalDate,
  summarizePlanCoverage,
  upcomingPaydays,
  type Payday,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { formatDollarsInput, parseDollarsToCents } from '@/components/bills/common';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

interface Portion {
  paydayKey: string;
  amount: string;
}

interface QuickOption {
  label: string;
  amountCents: number;
}

function paydayLabel(payday: Payday): string {
  const date = parseLocalDate(payday.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${date} · ${payday.label}`;
}

/**
 * "Plan payment": choose which upcoming paycheck(s) will cover a bill or a
 * debt payment. Planning only records intent (payday_assignments, shared with the Budget view) — it never
 * changes a balance or logs a payment.
 */
export default function PlanPaymentScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { kind, id } = useLocalSearchParams<{ kind: 'bill' | 'debt'; id: string }>();
  const [name, setName] = useState('');
  const [paydays, setPaydays] = useState<Payday[]>([]);
  const [quickOptions, setQuickOptions] = useState<QuickOption[]>([]);
  const [total, setTotal] = useState('');
  const [portions, setPortions] = useState<Portion[]>([{ paydayKey: '', amount: '' }]);
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    let mounted = true;
    (async () => {
      try {
        const [sources, plans] = await Promise.all([
          listIncomeSources(supabase, user.id),
          listPaydayAssignments(supabase, user.id).catch(() => []),
        ]);
        const upcoming = upcomingPaydays(
          sources.map((s) => ({
            id: s.id,
            label: s.label,
            amountCents: s.amount_cents,
            frequency: s.frequency,
            nextPayDate: s.next_pay_date,
          })),
          10
        );

        let itemName = '';
        let defaultTotal = 0;
        let options: QuickOption[] = [];
        if (kind === 'bill') {
          const bills = await listBillsWithPayments(supabase, user.id);
          const bill = bills.find((b) => b.id === id);
          if (bill) {
            const paid = bill.bill_payments.reduce((sum, p) => sum + p.amount_cents, 0);
            const remaining = Math.max(bill.amount_cents - paid, 0);
            itemName = bill.label;
            defaultTotal = remaining;
            options = [{ label: 'Pay what is left', amountCents: remaining }];
          }
        } else {
          const debts = await listDebtsWithPayments(supabase, user.id);
          const debt = debts.find((d) => d.id === id);
          if (debt) {
            itemName = debt.label;
            const isCard = debt.type === 'creditCard';
            const planned = debt.planned_payment_cents ?? null;
            defaultTotal = planned ?? debt.minimum_payment_cents;
            options = isCard
              ? [
                  { label: 'Pay minimum', amountCents: debt.minimum_payment_cents },
                  ...(planned !== null
                    ? [{ label: 'Pay planned amount', amountCents: planned }]
                    : []),
                  { label: 'Pay full balance', amountCents: debt.balance_cents },
                ]
              : [
                  { label: 'Pay regular amount', amountCents: debt.minimum_payment_cents },
                  { label: 'Pay full balance', amountCents: debt.balance_cents },
                ];
          }
        }

        // Saved portions come back as selectable paydays even if that date has passed.
        const existing = plans.filter((p) => p.target_type === kind && p.target_id === id);
        const sourceLabels = new Map(sources.map((src) => [src.id, src.label]));
        const options2 = [...upcoming];
        const existingPortions: Portion[] = existing.map((p) => {
          const key = `${p.income_source_id}|${p.pay_date}`;
          if (!options2.some((o) => o.key === key)) {
            options2.push({
              key,
              incomeSourceId: p.income_source_id,
              date: p.pay_date,
              label: sourceLabels.get(p.income_source_id) ?? 'Saved payday',
              amountCents: 0,
            });
          }
          return { paydayKey: key, amount: formatDollarsInput(p.amount_cents) };
        });

        if (!mounted) return;
        setName(itemName);
        setQuickOptions(options.filter((o) => o.amountCents > 0));
        setPaydays(options2.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
        setTotal(
          formatDollarsInput(
            existing.length > 0
              ? existing.reduce((sum, p) => sum + p.amount_cents, 0)
              : defaultTotal || null
          )
        );
        if (existingPortions.length > 0) setPortions(existingPortions);
      } catch (error) {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : "We couldn't load this plan.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, kind, id]);

  const totalCents = parseDollarsToCents(total) ?? 0;
  const portionCents = portions.map((p) => parseDollarsToCents(p.amount) ?? 0);
  const coverage = summarizePlanCoverage(
    totalCents,
    portionCents.map((amountCents) => ({ amountCents }))
  );

  function updatePortion(index: number, changes: Partial<Portion>) {
    setPortions((list) => list.map((p, i) => (i === index ? { ...p, ...changes } : p)));
  }

  async function handleSave() {
    if (!id) return;
    const valid = portions
      .map((p) => ({
        payday: paydays.find((d) => d.key === p.paydayKey),
        cents: parseDollarsToCents(p.amount),
      }))
      .filter((p) => p.payday && p.cents && p.cents > 0);
    setErrorMessage(null);
    setIsSaving(true);
    try {
      if (!user) return;
      await replacePaydayPlan(
        supabase,
        user.id,
        { type: kind === 'bill' ? 'bill' : 'debt', id },
        valid.map((p) => ({
          incomeSourceId: p.payday!.incomeSourceId,
          payDate: p.payday!.date,
          amountCents: p.cents!,
        }))
      );
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  const coverageText =
    coverage.kind === 'unplanned'
      ? 'Nothing assigned yet'
      : coverage.kind === 'full'
        ? '✓ Fully planned'
        : coverage.kind === 'partial'
          ? `${formatCents(coverage.remainingCents)} still unassigned`
          : `${formatCents(coverage.overCents)} over the total amount`;

  return (
    <Screen>
      <Stack.Screen options={{ title: name ? `Plan payment — ${name}` : 'Plan payment' }} />
      <ThemedText themeColor="textSecondary">
        Choose which paycheck(s) will cover this. Planning here does not change balances or record a
        payment.
      </ThemedText>

      {!isLoading && paydays.length === 0 ? (
        <Card style={{ gap: Space[3] }}>
          <ThemedText type="smallBold">No upcoming paydays yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add an income source with a next pay date and your upcoming paychecks will show up here.
          </ThemedText>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button label="Add income" onPress={() => router.push('/add-income')} />
          </View>
        </Card>
      ) : null}

      {quickOptions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
          {quickOptions.map((option) => (
            <Button
              key={option.label}
              label={`${option.label} (${formatCents(option.amountCents)})`}
              variant="secondary"
              onPress={() => setTotal(formatDollarsInput(option.amountCents))}
            />
          ))}
        </View>
      ) : null}

      <TextField
        label="Total amount due ($)"
        value={total}
        onChangeText={setTotal}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      <ThemedText type="smallBold" themeColor="primary">
        Split across paycheck(s)
      </ThemedText>

      {portions.map((portion, index) => {
        const selected = paydays.find((d) => d.key === portion.paydayKey);
        const isOpen = openPicker === index;
        return (
          <Card key={index} style={{ gap: Space[3], padding: Space[4] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Payday for portion ${index + 1}: ${
                selected ? paydayLabel(selected) : 'not chosen'
              }`}
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpenPicker(isOpen ? null : index)}
              style={{
                minHeight: 52,
                borderWidth: 1.5,
                borderColor: theme.controlBorder,
                borderRadius: Radius.input,
                paddingHorizontal: Space[3],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <ThemedText>{selected ? paydayLabel(selected) : 'Choose a payday'}</ThemedText>
              <ThemedText themeColor="textSecondary">{isOpen ? '▴' : '▾'}</ThemedText>
            </Pressable>
            {isOpen ? (
              <View style={{ gap: Space[1] }}>
                {paydays.map((payday) => {
                  const isChosen = payday.key === portion.paydayKey;
                  return (
                    <Pressable
                      key={payday.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isChosen }}
                      onPress={() => {
                        updatePortion(index, { paydayKey: payday.key });
                        setOpenPicker(null);
                      }}
                      style={{
                        minHeight: 44,
                        paddingHorizontal: Space[3],
                        borderRadius: Radius.chip,
                        justifyContent: 'center',
                        backgroundColor: isChosen ? theme.primaryMuted : 'transparent',
                      }}
                    >
                      <ThemedText type="small">
                        {isChosen ? '✓ ' : ''}
                        {paydayLabel(payday)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Space[2] }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Amount ($)"
                  value={portion.amount}
                  onChangeText={(amount) => updatePortion(index, { amount })}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              {portions.length > 1 ? (
                <IconButton
                  accessibilityLabel={`Remove portion ${index + 1}`}
                  onPress={() => setPortions((list) => list.filter((_, i) => i !== index))}
                >
                  <ThemedText>✕</ThemedText>
                </IconButton>
              ) : null}
            </View>
          </Card>
        );
      })}

      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          label="+ Split to another paycheck"
          variant="secondary"
          onPress={() => setPortions((list) => [...list, { paydayKey: '', amount: '' }])}
        />
      </View>

      <ThemedText
        type="smallBold"
        themeColor={
          coverage.kind === 'full'
            ? 'success'
            : coverage.kind === 'over'
              ? 'warning'
              : 'textSecondary'
        }
        accessibilityLiveRegion="polite"
      >
        {coverageText}
      </ThemedText>

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      <Button
        variant="panel"
        label={isSaving ? 'Saving…' : 'Save plan'}
        onPress={handleSave}
        disabled={isSaving || isLoading}
      />
    </Screen>
  );
}
