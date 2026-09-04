import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listBillsWithPayments, type BillWithPayments } from '@own-my-budget/api';
import { deriveBillStatus, formatCents, type BillStatus } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { MaxContentWidth, Spacing } from '@/constants/theme';

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
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four }}>
            <EmptyState
              title="Track your real bills"
              message="Guest mode shows sample data only. Create a free account to add your own bills and record payments."
            />
            <View style={{ marginTop: Spacing.three }}>
              <Button label="Create an account" onPress={() => router.push('/sign-up')} />
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
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
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
          <View
            style={{
              width: '100%',
              maxWidth: MaxContentWidth,
              alignSelf: 'center',
              gap: Spacing.four,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <ThemedText type="title" style={{ fontSize: 24 }}>
                Bills
              </ThemedText>
              <Button label="+ Add" variant="secondary" onPress={() => router.push('/add-bill')} />
            </View>

            {!isLoading && bills.length === 0 && (
              <EmptyState
                title="No bills yet"
                message="Add your first bill to start tracking what's due."
              />
            )}

            {GROUP_ORDER.map((groupStatus) => {
              const group = withStatus.filter((b) => b.billStatus === groupStatus);
              if (group.length === 0) return null;
              return (
                <Card key={groupStatus} style={{ gap: Spacing.three }}>
                  <ThemedText type="smallBold">{GROUP_TITLE[groupStatus]}</ThemedText>
                  {group.map(({ bill, billStatus, remainingCents }) => (
                    <View
                      key={bill.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View>
                        <ThemedText>{bill.label}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Due {bill.due_date}
                          {remainingCents < bill.amount_cents && remainingCents > 0
                            ? ` · ${formatCents(remainingCents)} left`
                            : ''}
                        </ThemedText>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <ThemedText style={{ fontWeight: '700' }}>
                          {formatCents(bill.amount_cents)}
                        </ThemedText>
                        {billStatus === 'paid' ? (
                          <StatusPill
                            label={STATUS_LABEL[billStatus]}
                            tone={STATUS_TONE[billStatus]}
                          />
                        ) : (
                          <Button
                            label="Record payment"
                            variant="secondary"
                            onPress={() =>
                              router.push({
                                pathname: '/record-bill-payment',
                                params: { billId: bill.id },
                              })
                            }
                          />
                        )}
                      </View>
                    </View>
                  ))}
                </Card>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
