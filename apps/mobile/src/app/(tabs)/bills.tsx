import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  listBillsWithPayments,
  listDebtsWithPayments,
  type BillWithPayments,
  type DebtWithPayments,
} from '@own-my-budget/api';
import {
  calculateCreditUtilization,
  calculatePayoffSchedule,
  deriveBillStatus,
  formatCents,
  type BillStatus,
  type DebtInput,
} from '@own-my-budget/core';

import { BillRow } from '@/components/ui/bill-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyText } from '@/components/ui/currency-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { GuestGate } from '@/components/ui/guest-gate';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { SubsectionHeader } from '@/components/ui/subsection-header';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';

const STATUS_TONE: Record<BillStatus, StatusTone> = {
  paid: 'success',
  upcoming: 'neutral',
  overdue: 'warning',
};

const STATUS_LABEL: Record<BillStatus, string> = {
  paid: 'Paid',
  upcoming: 'Upcoming',
  overdue: 'Watch this',
};

const GROUP_ORDER: BillStatus[] = ['overdue', 'upcoming', 'paid'];
const GROUP_TITLE: Record<BillStatus, string> = {
  overdue: 'Needs attention',
  upcoming: 'Upcoming',
  paid: 'Paid',
};

export default function BillsScreen() {
  const { status, user } = useAuth();
  const [bills, setBills] = useState<BillWithPayments[]>([]);
  const [debts, setDebts] = useState<DebtWithPayments[]>([]);
  const [extraMonthly, setExtraMonthly] = useState('0');
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setIsLoading(true);
    const [b, d] = await Promise.all([
      listBillsWithPayments(supabase, user.id),
      listDebtsWithPayments(supabase, user.id),
    ]);
    setBills(b);
    setDebts(d);
    setIsLoading(false);
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const debtInputs: DebtInput[] = useMemo(
    () =>
      debts.map((d) => ({
        id: d.id,
        balanceCents: d.balance_cents,
        aprBasisPoints: d.apr_basis_points,
        minimumPaymentCents: d.minimum_payment_cents,
      })),
    [debts]
  );
  const extraMonthlyCents = Math.round((parseFloat(extraMonthly) || 0) * 100);
  const snowball =
    debtInputs.length > 0
      ? calculatePayoffSchedule(debtInputs, extraMonthlyCents, 'snowball')
      : null;
  const avalanche =
    debtInputs.length > 0
      ? calculatePayoffSchedule(debtInputs, extraMonthlyCents, 'avalanche')
      : null;

  if (status === 'guest') {
    return (
      <GuestGate
        title="Track your real bills and debt"
        message="Guest mode shows sample data only. Create a free account to add your own bills, cards, and loans."
      />
    );
  }

  const today = new Date();
  const withStatus = bills.map((bill) => {
    const paidCents = bill.bill_payments.reduce((sum, p) => sum + p.amount_cents, 0);
    const { status: billStatus, remainingCents } = deriveBillStatus(
      bill.amount_cents,
      paidCents,
      bill.due_date,
      today
    );
    return { bill, billStatus, remainingCents };
  });

  return (
    <Screen>
      <ScreenHeader
        title="Bills & Debt"
        action={
          <Button label="+ Add bill" variant="secondary" onPress={() => router.push('/add-bill')} />
        }
      />

      {!isLoading && bills.length === 0 && (
        <EmptyState
          title="No bills yet"
          message="Add your first bill to start tracking what's due."
          mascot
        />
      )}

      {GROUP_ORDER.map((groupStatus) => {
        const group = withStatus.filter((b) => b.billStatus === groupStatus);
        if (group.length === 0) return null;
        return (
          <SectionCard key={groupStatus} title={GROUP_TITLE[groupStatus]}>
            <View style={{ gap: Space[4] }}>
              {group.map(({ bill, billStatus, remainingCents }) => (
                <BillRow
                  key={bill.id}
                  label={bill.label}
                  caption={
                    `Due ${bill.due_date}` +
                    (remainingCents < bill.amount_cents && remainingCents > 0
                      ? ` · ${formatCents(remainingCents)} left`
                      : '')
                  }
                  amountCents={bill.amount_cents}
                  trailing={
                    billStatus === 'paid' ? (
                      <StatusPill label={STATUS_LABEL[billStatus]} tone={STATUS_TONE[billStatus]} />
                    ) : (
                      <Button
                        label="Record payment"
                        variant={billStatus === 'overdue' ? 'primary' : 'secondary'}
                        onPress={() =>
                          router.push({
                            pathname: '/record-bill-payment',
                            params: { billId: bill.id },
                          })
                        }
                      />
                    )
                  }
                />
              ))}
            </View>
          </SectionCard>
        );
      })}

      {/* ---------- Debt ---------- */}
      <SubsectionHeader
        title="Debt"
        action={
          <Button label="+ Add debt" variant="secondary" onPress={() => router.push('/add-debt')} />
        }
      />

      {!isLoading && debts.length === 0 && (
        <EmptyState
          title="No debts tracked"
          message="Add a credit card, loan, or mortgage to get started."
        />
      )}

      {debts.map((debt) => {
        const paidCents = debt.debt_payments.reduce((sum, p) => sum + p.amount_cents, 0);
        const utilization =
          debt.type === 'creditCard' && debt.credit_limit_cents
            ? calculateCreditUtilization(debt.balance_cents, debt.credit_limit_cents)
            : null;
        return (
          <Card key={debt.id} style={{ gap: Space[2] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText type="smallBold">{debt.label}</ThemedText>
              <CurrencyText cents={debt.balance_cents} size="row" />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {(debt.apr_basis_points / 100).toFixed(2)}% APR ·{' '}
              {formatCents(debt.minimum_payment_cents)}
              /mo min
              {utilization !== null ? ` · ${utilization.toFixed(0)}% utilized` : ''}
              {paidCents > 0 ? ` · ${formatCents(paidCents)} paid so far` : ''}
            </ThemedText>
            {utilization !== null ? (
              <ProgressBar percent={utilization} tone={utilization > 70 ? 'watch' : 'primary'} />
            ) : null}
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label="Record payment"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/record-debt-payment', params: { debtId: debt.id } })
                }
              />
            </View>
          </Card>
        );
      })}

      {debts.length > 0 && (
        <SectionCard title="Payoff plan: snowball vs. avalanche">
          <TextField
            label="Extra you can put toward debt each month"
            value={extraMonthly}
            onChangeText={setExtraMonthly}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <Grid gap={Space[3]}>
            <View style={{ flexGrow: 1, flexBasis: 150 }}>
              <PayoffSummary title="Snowball" result={snowball} />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 150 }}>
              <PayoffSummary title="Avalanche" result={avalanche} />
            </View>
          </Grid>
          <ThemedText type="small" themeColor="textSecondary">
            Snowball pays off the smallest balance first; avalanche pays off the highest interest
            rate first (usually less total interest).
          </ThemedText>
        </SectionCard>
      )}
    </Screen>
  );
}

function PayoffSummary({
  title,
  result,
}: {
  title: string;
  result: { months: number; totalInterestCents: number; payoffDate: string } | null;
}) {
  return (
    <Card style={{ gap: Space[1] }}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {result ? (
        <>
          <ThemedText type="small">{result.months} months</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatCents(result.totalInterestCents)} interest
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Debt-free {result.payoffDate}
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          —
        </ThemedText>
      )}
    </Card>
  );
}
