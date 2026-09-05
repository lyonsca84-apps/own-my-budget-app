import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getCurrentAccount,
  getFeatureUsageCount,
  sendBudgetBuddyMessage,
  type BudgetBuddyHistoryMessage,
} from '@own-my-budget/api';
import {
  evaluateFeatureGate,
  getUsagePeriodStart,
  FEATURE_REGISTRY,
  type FeatureGateResult,
  type PlanTier,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

interface ChatMessage extends BudgetBuddyHistoryMessage {
  id: string;
}

export default function HelperScreen() {
  const { status, user } = useAuth();
  const theme = useTheme();
  const [gate, setGate] = useState<FeatureGateResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const reloadGate = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    const account = await getCurrentAccount(supabase, user.id);
    const plan = account.entitlement.plan_tier as PlanTier;
    const limit = FEATURE_REGISTRY.budgetBuddyAction.limits[plan];
    const periodStart = getUsagePeriodStart(
      limit.kind === 'count' ? (limit.period ?? 'lifetime') : 'lifetime'
    );
    const currentUsage = await getFeatureUsageCount(
      supabase,
      user.id,
      'budgetBuddyAction',
      periodStart
    );
    setGate(evaluateFeatureGate('budgetBuddyAction', { plan, currentUsage }));
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reloadGate();
    }, [reloadGate])
  );

  async function handleSend() {
    if (!draft.trim() || !gate?.allowed || isSending) return;
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: draft.trim(),
    };
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setErrorMessage(null);
    setIsSending(true);
    try {
      const reply = await sendBudgetBuddyMessage(supabase, userMessage.content, history);
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-assistant`, role: 'assistant', content: reply },
      ]);
      await reloadGate();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }

  function handleClearChat() {
    setMessages([]);
    setErrorMessage(null);
  }

  if (status === 'guest') {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four }}>
            <EmptyState
              title="Meet Budget Buddy"
              message="Create a free account to chat with Budget Buddy and scan receipts or your pantry."
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: Spacing.four,
              paddingBottom: 0,
            }}
          >
            <ThemedText type="title" style={{ fontSize: 22 }}>
              Budget Buddy
            </ThemedText>
            {messages.length > 0 ? (
              <Button label="Clear chat" variant="secondary" onPress={handleClearChat} />
            ) : null}
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: Spacing.two,
              padding: Spacing.four,
              paddingBottom: 0,
            }}
          >
            <View style={{ flex: 1 }}>
              <Button
                label="Scan a receipt"
                variant="secondary"
                onPress={() => router.push('/scan-receipt')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Scan pantry"
                variant="secondary"
                onPress={() => router.push('/scan-pantry')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Grocery list"
                variant="secondary"
                onPress={() => router.push('/grocery-list')}
              />
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <Card>
                <ThemedText themeColor="textSecondary">
                  Ask me about your budget, bills, debt, or savings goals. I can&rsquo;t give tax,
                  legal, or investment advice — just budgeting help, using your own numbers.
                </ThemedText>
              </Card>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    backgroundColor:
                      message.role === 'user' ? theme.primary : theme.backgroundElement,
                    borderRadius: Spacing.three,
                    borderWidth: message.role === 'assistant' ? 1 : 0,
                    borderColor: theme.border,
                    padding: Spacing.three,
                  }}
                >
                  <ThemedText themeColor={message.role === 'user' ? 'onPrimary' : 'text'}>
                    {message.content}
                  </ThemedText>
                </View>
              ))
            )}
            {isSending ? (
              <ThemedText themeColor="textSecondary" type="small">
                Budget Buddy is thinking…
              </ThemedText>
            ) : null}
          </ScrollView>

          <View style={{ padding: Spacing.four, gap: Spacing.two }}>
            {gate && !gate.allowed ? (
              <ThemedText type="small" themeColor="danger">
                {gate.reason}
              </ThemedText>
            ) : gate?.kind === 'count' && gate.remaining !== undefined ? (
              <ThemedText type="small" themeColor="textSecondary">
                {gate.remaining} message{gate.remaining === 1 ? '' : 's'} remaining
              </ThemedText>
            ) : null}
            {errorMessage ? (
              <ThemedText type="small" themeColor="danger">
                {errorMessage}
              </ThemedText>
            ) : null}
            <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Message"
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Ask Budget Buddy anything about your money"
                  multiline
                  editable={!!gate?.allowed}
                />
              </View>
              <Button
                label={isSending ? 'Sending…' : 'Send'}
                onPress={handleSend}
                disabled={!draft.trim() || !gate?.allowed || isSending}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
