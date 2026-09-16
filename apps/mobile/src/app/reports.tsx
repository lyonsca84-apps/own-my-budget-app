import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { getCurrentAccount } from '@own-my-budget/api';
import { evaluateFeatureGate, type FeatureGateResult, type PlanTier } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GuestGate } from '@/components/ui/guest-gate';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Space } from '@/constants/theme';

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
      <GuestGate
        title="See your full picture"
        message="Create a free account to unlock spending, income, and progress reports."
      />
    );
  }

  return (
    <Screen>
      {gate && !gate.allowed ? (
        <Card>
          <ThemedText themeColor="warning">{gate.reason}</ThemedText>
        </Card>
      ) : null}

      {REPORTS.map((report) => (
        <SectionCard key={report.href} title={report.title}>
          <View style={{ gap: Space[3] }}>
            <ThemedText themeColor="textSecondary">{report.description}</ThemedText>
            <Button
              label="View"
              variant="secondary"
              onPress={() => router.push(report.href)}
              disabled={!gate?.allowed}
            />
          </View>
        </SectionCard>
      ))}

      <SectionCard title="Export your data">
        <View style={{ gap: Space[3] }}>
          <ThemedText themeColor="textSecondary">CSV and JSON, available on every plan.</ThemedText>
          <Button label="Export" variant="secondary" onPress={() => router.push('/export-data')} />
        </View>
      </SectionCard>
    </Screen>
  );
}
