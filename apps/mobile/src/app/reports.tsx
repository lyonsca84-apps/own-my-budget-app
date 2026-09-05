import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentAccount } from '@own-my-budget/api';
import { evaluateFeatureGate, type FeatureGateResult, type PlanTier } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

const REPORTS: {
  title: string;
  description: string;
  href: '/report-spending' | '/report-income-expenses' | '/report-debt-savings';
}[] = [
  {
    title: 'Spending by category',
    description: 'Where your bill payments went, over a selectable time range.',
    href: '/report-spending',
  },
  {
    title: 'Income vs. expenses',
    description: 'A simple monthly trend of what came in against what went out.',
    href: '/report-income-expenses',
  },
  {
    title: 'Debt & savings progress',
    description: "A combined view of what you've paid down and saved up.",
    href: '/report-debt-savings',
  },
];

export default function ReportsScreen() {
  const { status, user } = useAuth();
  const [gate, setGate] = useState<FeatureGateResult | null>(null);

  const reload = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    const account = await getCurrentAccount(supabase, user.id);
    const plan = account.entitlement.plan_tier as PlanTier;
    setGate(evaluateFeatureGate('fullReports', { plan }));
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (status !== 'signedIn') {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ padding: Spacing.five }}>
            <EmptyState
              title="See your full picture"
              message="Create a free account to unlock spending, income, and progress reports."
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
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.five, gap: Spacing.three }}>
          <ThemedText type="title" style={{ fontSize: 22 }}>
            Reports
          </ThemedText>

          {gate && !gate.allowed ? (
            <Card>
              <ThemedText themeColor="danger">{gate.reason}</ThemedText>
            </Card>
          ) : null}

          {REPORTS.map((report) => (
            <Card key={report.href} style={{ gap: Spacing.two }}>
              <ThemedText type="subtitle" style={{ fontSize: 18 }}>
                {report.title}
              </ThemedText>
              <ThemedText themeColor="textSecondary">{report.description}</ThemedText>
              <Button
                label="View"
                variant="secondary"
                onPress={() => router.push(report.href)}
                disabled={!gate?.allowed}
              />
            </Card>
          ))}

          <Card style={{ gap: Spacing.two }}>
            <ThemedText type="subtitle" style={{ fontSize: 18 }}>
              Export your data
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              CSV and JSON, available on every plan.
            </ThemedText>
            <Button
              label="Export"
              variant="secondary"
              onPress={() => router.push('/export-data')}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
