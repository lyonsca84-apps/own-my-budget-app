import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listCategories, listIncomeSources, listPaychecks, type Tables } from '@own-my-budget/api';
import { formatCents } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function PlanScreen() {
  const { status, user } = useAuth();
  const [categories, setCategories] = useState<Tables<'categories'>[]>([]);
  const [incomeSources, setIncomeSources] = useState<Tables<'income_sources'>[]>([]);
  const [paychecks, setPaychecks] = useState<Tables<'paychecks'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    setIsLoading(true);
    const [c, i, p] = await Promise.all([
      listCategories(supabase, user.id),
      listIncomeSources(supabase, user.id),
      listPaychecks(supabase, user.id),
    ]);
    setCategories(c);
    setIncomeSources(i);
    setPaychecks(p);
    setIsLoading(false);
  }, [status, user]);

  // Refetch every time the tab regains focus — e.g. after saving a new
  // category on the pushed "Add category" screen and navigating back.
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
              title="Ready to plan for real?"
              message="Guest mode shows sample data only. Create a free account to add your own income, categories, and paychecks."
            />
            <View style={{ marginTop: Spacing.three }}>
              <Button label="Create an account" onPress={() => router.push('/sign-up')} />
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

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
            <ThemedText type="title" style={{ fontSize: 24 }}>
              Plan
            </ThemedText>

            <Card style={{ gap: Spacing.three }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <ThemedText type="smallBold">Income sources</ThemedText>
                <Button
                  label="+ Add"
                  variant="secondary"
                  onPress={() => router.push('/add-income')}
                />
              </View>
              {!isLoading && incomeSources.length === 0 && (
                <ThemedText themeColor="textSecondary" type="small">
                  No income sources yet.
                </ThemedText>
              )}
              {incomeSources.map((income) => (
                <View
                  key={income.id}
                  style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <ThemedText>{income.label}</ThemedText>
                  <ThemedText style={{ fontWeight: '700' }}>
                    {formatCents(income.amount_cents)}
                  </ThemedText>
                </View>
              ))}
            </Card>

            <Card style={{ gap: Spacing.three }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <ThemedText type="smallBold">Categories</ThemedText>
                <Button
                  label="+ Add"
                  variant="secondary"
                  onPress={() => router.push('/add-category')}
                />
              </View>
              {!isLoading && categories.length === 0 && (
                <ThemedText themeColor="textSecondary" type="small">
                  No categories yet.
                </ThemedText>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                {categories.map((category) => (
                  <StatusPill key={category.id} label={category.name} tone="neutral" />
                ))}
              </View>
            </Card>

            <Card style={{ gap: Spacing.three }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <ThemedText type="smallBold">Paychecks</ThemedText>
                <Button
                  label="+ Add"
                  variant="secondary"
                  onPress={() => router.push('/add-paycheck')}
                />
              </View>
              {!isLoading && paychecks.length === 0 && (
                <ThemedText themeColor="textSecondary" type="small">
                  No paychecks logged yet.
                </ThemedText>
              )}
              {paychecks.map((paycheck) => (
                <View
                  key={paycheck.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <ThemedText style={{ fontWeight: '700' }}>
                      {formatCents(paycheck.amount_cents)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {paycheck.pay_date}
                    </ThemedText>
                  </View>
                  {paycheck.is_assigned ? (
                    <StatusPill label="Assigned" tone="success" />
                  ) : (
                    <Button
                      label="Assign"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: '/assign-paycheck',
                          params: { paycheckId: paycheck.id },
                        })
                      }
                    />
                  )}
                </View>
              ))}
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
