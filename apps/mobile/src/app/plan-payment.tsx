/**
 * "Plan payment" dialog — choose which upcoming paycheck(s) will cover a bill,
 * a debt payment or a savings-goal contribution. Planning only records intent
 * in `payday_assignments` (shared with the Budget page's Payday view); it
 * never changes a balance or logs a payment.
 *
 * ROUTE CONTRACT — `router.push({ pathname: '/plan-payment', params })`:
 *
 *   targetType   'bill' | 'debt' | 'savings_goal'        (required)
 *   targetId     id of the bill / debt / savings goal     (required)
 *   amountCents  optional integer cents to prefill "Total amount due"
 *   amount       optional dollars ("150" / "150.00"), used when amountCents is absent
 *
 *   Legacy names still work: `kind` = targetType, `id` = targetId.
 *
 * Without an amount the dialog defaults sensibly: a bill's remaining balance
 * (or its full amount when already paid), a debt's planned/minimum payment,
 * and blank for a savings goal. Existing saved portions for the target load
 * back in and Save replaces the whole split (an empty split clears the plan).
 * Save is blocked while the split is over the total; under-planning is fine
 * and says how much is still unassigned. On save/cancel the dialog just
 * closes — the calling page re-reads on focus.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  getSavingsGoal,
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DialogScreen } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type TargetType = 'bill' | 'debt' | 'savings_goal';

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

const isTargetType = (value: unknown): value is TargetType =>
  value === 'bill' || value === 'debt' || value === 'savings_goal';

export default function PlanPaymentScreen() {
  const theme = useTheme();
  const { userId, isReady } = useDataUser();
  const params = useLocalSearchParams<{
    targetType?: string;
    targetId?: string;
    kind?: string;
    id?: string;
    amountCents?: string;
    amount?: string;
  }>();
  const targetType = [params.targetType, params.kind].find(isTargetType) as TargetType | undefined;
  const targetId = params.targetId ?? params.id;

  // Optional caller-supplied total.
  const suppliedCents = useMemo(() => {
    const fromCents = Number(params.amountCents);
    if (params.amountCents && Number.isFinite(fromCents) && fromCents > 0) {
      return Math.round(fromCents);
    }
    return params.amount ? (parseDollarsToCents(params.amount) ?? 0) : 0;
  }, [params.amountCents, params.amount]);

  const [name, setName] = useState('');
  const [paydays, setPaydays] = useState<Payday[]>([]);
  const [quickOptions, setQuickOptions] = useState<QuickOption[]>([]);
  const [total, setTotal] = useState('');
  const [portions, setPortions] = useState<Portion[]>([{ paydayKey: '', amount: '' }]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !userId || !targetType || !targetId) return;
    let mounted = true;
    (async () => {
      try {
        const [sources, plans] = await Promise.all([
          listIncomeSources(supabase, userId),
          listPaydayAssignments(supabase, userId).catch(() => []),
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
        if (targetType === 'bill') {
          const bills = await listBillsWithPayments(supabase, userId);
          const bill = bills.find((b) => b.id === targetId);
          if (bill) {
            const paid = bill.bill_payments.reduce((sum, p) => sum + p.amount_cents, 0);
            const remaining = Math.max(bill.amount_cents - paid, 0);
            itemName = bill.label;
            // A fully paid bill can still be planned for next time — offer the full amount.
            defaultTotal = remaining > 0 ? remaining : bill.amount_cents;
            options = [
              ...(remaining > 0 ? [{ label: 'Pay what is left', amountCents: remaining }] : []),
              { label: 'Full amount', amountCents: bill.amount_cents },
            ];
          }
        } else if (targetType === 'debt') {
          const debts = await listDebtsWithPayments(supabase, userId);
          const debt = debts.find((d) => d.id === targetId);
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
        } else {
          const goal = await getSavingsGoal(supabase, targetId).catch(() => null);
          if (goal) itemName = goal.label;
        }

        // Saved portions come back as selectable paydays even if that date has passed.
        const existing = plans.filter(
          (p) => p.target_type === targetType && p.target_id === targetId
        );
        const sourceLabels = new Map(sources.map((src) => [src.id, src.label]));
        const paydayOptions = [...upcoming];
        const existingPortions: Portion[] = existing.map((p) => {
          const key = `${p.income_source_id}|${p.pay_date}`;
          if (!paydayOptions.some((o) => o.key === key)) {
            paydayOptions.push({
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
        setPaydays(paydayOptions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
        const totalCents =
          suppliedCents > 0
            ? suppliedCents
            : existing.length > 0
              ? existing.reduce((sum, p) => sum + p.amount_cents, 0)
              : defaultTotal;
        setTotal(totalCents > 0 ? formatDollarsInput(totalCents) : '');
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
  }, [isReady, userId, targetType, targetId, suppliedCents]);

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
    if (!targetType || !targetId || !userId) return;
    const filled = portions.filter((p) => p.amount.trim() || p.paydayKey);
    if (filled.some((p) => !p.paydayKey)) {
      setErrorMessage('Choose a payday for each amount you are splitting.');
      return;
    }
    if (filled.some((p) => !((parseDollarsToCents(p.amount) ?? 0) > 0))) {
      setErrorMessage('Enter an amount for each payday you chose.');
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const saved = filled.map((p) => {
        const payday = paydays.find((d) => d.key === p.paydayKey)!;
        return {
          incomeSourceId: payday.incomeSourceId,
          payDate: payday.date,
          amountCents: parseDollarsToCents(p.amount) as number,
        };
      });
      await replacePaydayPlan(supabase, userId, { type: targetType, id: targetId }, saved);
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  const over = coverage.kind === 'over';
  const coverageText =
    coverage.kind === 'unplanned'
      ? null
      : coverage.kind === 'full'
        ? '✓ Fully planned'
        : coverage.kind === 'partial'
          ? `${formatCents(coverage.remainingCents)} still unassigned`
          : `${formatCents(coverage.overCents)} over the total amount`;

  return (
    <DialogScreen
      title={name ? `Plan payment — ${name}` : 'Plan payment'}
      subtitle="Choose which paycheck(s) will cover this. Planning here does not change balances."
      primaryLabel="Save plan"
      onPrimary={handleSave}
      primaryDisabled={isLoading || over || !targetType || !targetId}
      busy={isSaving}
      errorMessage={errorMessage}
    >
      <View style={{ gap: Space[3] }}>
        {!isLoading && paydays.length === 0 ? (
          <Card style={{ gap: Space[3], padding: Space[4] }}>
            <ThemedText type="smallBold">No upcoming paydays yet</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Add an income source with a next pay date and your upcoming paychecks will show up
              here.
            </ThemedText>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label="Add income"
                size="sm"
                shape="rounded"
                onPress={() => router.push('/add-income')}
              />
            </View>
          </Card>
        ) : null}

        <TextField
          label="Total amount due"
          value={total}
          onChangeText={setTotal}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        {quickOptions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
            {quickOptions.map((option) => (
              <Button
                key={option.label}
                label={`${option.label} (${formatCents(option.amountCents)})`}
                variant="soft"
                size="sm"
                shape="rounded"
                onPress={() => setTotal(formatDollarsInput(option.amountCents))}
              />
            ))}
          </View>
        ) : null}

        <ThemedText
          type="smallBold"
          themeColor="solidAccent"
          style={{ fontFamily: Fonts.body.semibold, marginTop: Space[2] }}
        >
          Split across paycheck(s)
        </ThemedText>

        {portions.map((portion, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
            <View style={{ flex: 3, minWidth: 0 }}>
              <SelectField
                label={`Payday for portion ${index + 1}`}
                hideLabel
                value={portion.paydayKey}
                onChange={(value) => updatePortion(index, { paydayKey: value })}
                placeholder="Choose a payday"
                options={paydays.map((p) => ({ value: p.key, label: paydayLabel(p) }))}
              />
            </View>
            <View style={{ flex: 2, minWidth: 0 }}>
              <TextField
                label={`Amount for portion ${index + 1}`}
                hideLabel
                value={portion.amount}
                onChangeText={(amount) => updatePortion(index, { amount })}
                placeholder="Amount"
                keyboardType="decimal-pad"
              />
            </View>
            {portions.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove portion ${index + 1}`}
                onPress={() => setPortions((list) => list.filter((_, i) => i !== index))}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <ThemedText
                  style={{ color: theme.clay, fontFamily: Fonts.body.bold, fontSize: 20 }}
                >
                  ✕
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ))}

        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label="+ Split to another paycheck"
            variant="soft"
            size="sm"
            shape="rounded"
            onPress={() => setPortions((list) => [...list, { paydayKey: '', amount: '' }])}
          />
        </View>

        {coverageText ? (
          <ThemedText
            type="smallBold"
            themeColor={coverage.kind === 'full' ? 'success' : over ? 'clay' : 'textSecondary'}
            accessibilityLiveRegion="polite"
            accessibilityRole={over ? 'alert' : undefined}
          >
            {coverageText}
          </ThemedText>
        ) : null}
      </View>
    </DialogScreen>
  );
}
