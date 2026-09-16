import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { listBillsWithPayments, type BillWithPayments } from '@own-my-budget/api';
import { deriveBillStatus, formatCents, type BillStatus } from '@own-my-budget/core';

import { BillRow } from '@/components/ui/bill-row';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { GuestGate } from '@/components/ui/guest-gate';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
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
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setIsLoading(true);
    setBills(await listBillsWithPayments(supabase, user.id));
    setIsLoading(false);
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (status === 'guest') {
    return (
      <GuestGate
        title="Track your real bills"
        message="Guest mode shows sample data only. Create a free account to add your own bills and record payments."
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
        title="Bills"
        action={
          <Button label="+ Add" variant="secondary" onPress={() => router.push('/add-bill')} />
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
    </Screen>
  );
}
