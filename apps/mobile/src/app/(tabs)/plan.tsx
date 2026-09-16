import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { listCategories, listIncomeSources, listPaychecks, type Tables } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { CurrencyText } from '@/components/ui/currency-text';
import { GuestGate } from '@/components/ui/guest-gate';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';

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
      <GuestGate
        title="Ready to plan for real?"
        message="Guest mode shows sample data only. Create a free account to add your own income, categories, and paychecks."
      />
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Plan" />

      <SectionCard
        title="Income sources"
        action={
          <Button label="+ Add" variant="secondary" onPress={() => router.push('/add-income')} />
        }
      >
        {!isLoading && incomeSources.length === 0 && (
          <ThemedText themeColor="textSecondary" type="small">
            No income sources yet.
          </ThemedText>
        )}
        <View style={{ gap: Space[3] }}>
          {incomeSources.map((income) => (
            <View key={income.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText>{income.label}</ThemedText>
              <CurrencyText cents={income.amount_cents} size="row" />
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard
        title="Categories"
        action={
          <Button label="+ Add" variant="secondary" onPress={() => router.push('/add-category')} />
        }
      >
        {!isLoading && categories.length === 0 && (
          <ThemedText themeColor="textSecondary" type="small">
            No categories yet.
          </ThemedText>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
          {categories.map((category) => (
            <StatusPill key={category.id} label={category.name} tone="neutral" />
          ))}
        </View>
      </SectionCard>

      <SectionCard
        title="Paychecks"
        action={
          <Button label="+ Add" variant="secondary" onPress={() => router.push('/add-paycheck')} />
        }
      >
        {!isLoading && paychecks.length === 0 && (
          <ThemedText themeColor="textSecondary" type="small">
            No paychecks logged yet.
          </ThemedText>
        )}
        <View style={{ gap: Space[3] }}>
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
                <CurrencyText cents={paycheck.amount_cents} size="row" />
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
        </View>
      </SectionCard>
    </Screen>
  );
}
