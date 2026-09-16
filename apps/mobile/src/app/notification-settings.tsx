import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type Tables,
} from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { rescheduleAllNotifications } from '@/lib/notifications';
import { Space } from '@/constants/theme';

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Tables<'notification_preferences'> | null>(null);
  const [daysBeforeInput, setDaysBeforeInput] = useState('3');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    const data = await getNotificationPreferences(supabase, user.id);
    setPrefs(data);
    setDaysBeforeInput(String(data.bill_reminder_days_before));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function toggle(
    field: keyof Pick<
      Tables<'notification_preferences'>,
      'bill_reminders_enabled' | 'payday_reminders_enabled' | 'goal_milestone_alerts_enabled'
    >
  ) {
    if (!user || !prefs) return;
    const updated = await updateNotificationPreferences(supabase, user.id, {
      [field]: !prefs[field],
    });
    setPrefs(updated);
  }

  async function handleSaveDaysBefore() {
    if (!user) return;
    const days = Math.max(0, Math.min(30, Math.round(parseFloat(daysBeforeInput)) || 0));
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const updated = await updateNotificationPreferences(supabase, user.id, {
        bill_reminder_days_before: days,
      });
      setPrefs(updated);
      await rescheduleAllNotifications(supabase, user.id);
      setStatusMessage('Saved.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!prefs) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionCard title="Reminders">
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <ThemedText>Bill reminders</ThemedText>
          <Button
            label={prefs.bill_reminders_enabled ? 'On' : 'Off'}
            variant={prefs.bill_reminders_enabled ? 'primary' : 'secondary'}
            onPress={() => toggle('bill_reminders_enabled')}
          />
        </View>
        {prefs.bill_reminders_enabled && (
          <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Days before due date"
                value={daysBeforeInput}
                onChangeText={setDaysBeforeInput}
                keyboardType="number-pad"
              />
            </View>
            <Button
              label={isSaving ? 'Saving…' : 'Save'}
              onPress={handleSaveDaysBefore}
              disabled={isSaving}
            />
          </View>
        )}

        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <ThemedText>Payday reminders</ThemedText>
          <Button
            label={prefs.payday_reminders_enabled ? 'On' : 'Off'}
            variant={prefs.payday_reminders_enabled ? 'primary' : 'secondary'}
            onPress={() => toggle('payday_reminders_enabled')}
          />
        </View>

        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <ThemedText>Goal milestone alerts</ThemedText>
          <Button
            label={prefs.goal_milestone_alerts_enabled ? 'On' : 'Off'}
            variant={prefs.goal_milestone_alerts_enabled ? 'primary' : 'secondary'}
            onPress={() => toggle('goal_milestone_alerts_enabled')}
          />
        </View>
      </SectionCard>

      {statusMessage ? <ThemedText themeColor="textSecondary">{statusMessage}</ThemedText> : null}

      <ThemedText themeColor="textSecondary">
        Reminders fire as local notifications on this device — no server needed. You may be asked to
        allow notifications the first time one of these is turned on.
      </ThemedText>
    </Screen>
  );
}
