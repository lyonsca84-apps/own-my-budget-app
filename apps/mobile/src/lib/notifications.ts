import * as Notifications from 'expo-notifications';
import type { TypedSupabaseClient, Tables } from '@own-my-budget/api';
import { formatCents, parseLocalDate } from '@own-my-budget/core';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return requested.granted;
}

/** 9am local time, a reasonable default that isn't the middle of the night. */
function atNineAm(date: Date): Date {
  const result = new Date(date);
  result.setHours(9, 0, 0, 0);
  return result;
}

function isInFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Cancels every previously scheduled notification and reschedules from
 * current data. Called whenever notification preferences change or the
 * user opens the Home tab, so notifications stay in sync with the bills
 * and income actually on file — there's no incremental diffing, just a
 * full recompute, which is simple and correct even if slightly wasteful.
 *
 * Payday reminders use each income source's stored `next_pay_date` as-is —
 * that field is set once at creation and isn't auto-advanced elsewhere in
 * the app (recurring pay-schedule projection doesn't exist yet), so a
 * reminder here naturally goes stale the same way the rest of the app's
 * "next payday" display already does. Not a new limitation introduced here.
 */
export async function rescheduleAllNotifications(
  client: TypedSupabaseClient,
  userId: string
): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const [prefsResult, billsResult, incomeResult] = await Promise.all([
    client.from('notification_preferences').select('*').eq('user_id', userId).single(),
    client
      .from('bills')
      .select('label, amount_cents, due_date')
      .eq('user_id', userId)
      .is('archived_at', null),
    client
      .from('income_sources')
      .select('label, amount_cents, next_pay_date')
      .eq('user_id', userId)
      .is('archived_at', null),
  ]);
  if (prefsResult.error) throw prefsResult.error;
  if (billsResult.error) throw billsResult.error;
  if (incomeResult.error) throw incomeResult.error;

  const prefs = prefsResult.data as Tables<'notification_preferences'>;

  if (prefs.bill_reminders_enabled) {
    for (const bill of billsResult.data) {
      const dueDate = parseLocalDate(bill.due_date);
      const reminderDate = atNineAm(
        new Date(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate() - prefs.bill_reminder_days_before
        )
      );
      if (!isInFuture(reminderDate)) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Bill due soon',
          body: `${bill.label} — ${formatCents(bill.amount_cents)} due ${bill.due_date}`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
      });
    }
  }

  // Goal milestone alerts fire immediately at deposit time (see
  // notifyGoalMilestoneIfCrossed), not scheduled ahead here — there's
  // nothing to reschedule for them.

  if (prefs.payday_reminders_enabled) {
    for (const income of incomeResult.data) {
      if (!income.next_pay_date) continue;
      const payDate = parseLocalDate(income.next_pay_date);
      const reminderDate = atNineAm(payDate);
      if (!isInFuture(reminderDate)) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Payday!',
          body: `${income.label} — ${formatCents(income.amount_cents)} expected today.`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
      });
    }
  }
}

const MILESTONE_THRESHOLDS = [25, 50, 75, 100];

/**
 * Fires an immediate local notification (trigger: null) the moment a
 * deposit crosses a 25/50/75/100% milestone — unlike bill/payday reminders,
 * this can't be scheduled ahead of time since it depends on the deposit
 * amount itself. Call this right after a successful deposit; a withdrawal
 * should never call it (going backward isn't a "hit a milestone" moment).
 * No-ops if the user has goal milestone alerts turned off or permission
 * hasn't been granted.
 */
export async function notifyGoalMilestoneIfCrossed(
  client: TypedSupabaseClient,
  userId: string,
  args: {
    goalLabel: string;
    previousSavedCents: number;
    newSavedCents: number;
    targetCents: number;
  }
): Promise<void> {
  if (args.targetCents <= 0) return;

  const { data: prefs, error } = await client
    .from('notification_preferences')
    .select('goal_milestone_alerts_enabled')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  if (!prefs.goal_milestone_alerts_enabled) return;

  const previousPercent = (args.previousSavedCents / args.targetCents) * 100;
  const newPercent = (args.newSavedCents / args.targetCents) * 100;
  const crossed = MILESTONE_THRESHOLDS.filter((t) => previousPercent < t && newPercent >= t);
  if (crossed.length === 0) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const highest = crossed[crossed.length - 1];
  const title = highest >= 100 ? 'Goal reached! 🎉' : `${highest}% of the way there`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: `${args.goalLabel}: ${formatCents(args.newSavedCents)} of ${formatCents(args.targetCents)}.`,
    },
    trigger: null,
  });
}
