import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { LimitNotice } from '@/components/ui/limit-notice';
import { Fonts, Layout, Radius, Space } from '@/constants/theme';
import { BrandAssets } from '@/design-system/assets/brand';
import { useTheme } from '@/hooks/use-theme';

import { BuddyVoiceControls } from './buddy-voice-controls';
import { useBuddyVoice } from './use-buddy-voice';
import type { BudgetBuddyChat as ChatState } from './use-budget-buddy-chat';

export const SUGGESTED_PROMPTS = [
  'Why did my available money drop this week?',
  'Am I on track with savings?',
  "What's the fastest way to pay off debt?",
] as const;

const SHORTCUTS: { label: string; href: '/scan-receipt' | '/scan-pantry' | '/grocery-list' }[] = [
  { label: 'Scan a receipt', href: '/scan-receipt' },
  { label: 'Scan pantry', href: '/scan-pantry' },
  { label: 'Grocery list', href: '/grocery-list' },
];

export interface BudgetBuddyChatProps {
  chat: ChatState;
  /** Called after a shortcut navigates away, so a floating panel can close itself. */
  onNavigate?: () => void;
}

/**
 * The Budget Buddy conversation body — intro, suggested prompts, messages,
 * composer and the educational-not-advice disclaimer — shared by the
 * floating panel (wide layouts) and the full-screen helper route.
 * The mascot only appears in the friendly intro, never on an error.
 */
export function BudgetBuddyChat({ chat, onNavigate }: BudgetBuddyChatProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const { gate, messages, isSending, draft } = chat;
  const voice = useBuddyVoice(chat);
  // While a spoken message is being recorded or worked on, typing waits its
  // turn — one message at a time, in one conversation.
  const voiceBusy =
    voice.phase === 'listening' || voice.phase === 'transcribing' || voice.phase === 'thinking';
  const blocked = gate !== null && !gate.allowed;
  const canSend = !!draft.trim() && !!gate?.allowed && !isSending && !voiceBusy;

  function sendTyped(text?: string) {
    voice.stopAudio();
    void chat.send(text);
  }

  function go(href: (typeof SHORTCUTS)[number]['href']) {
    onNavigate?.();
    router.push(href);
  }

  if (chat.isGuest) {
    return (
      <View
        style={{
          flex: 1,
          padding: Space[5],
          gap: Space[3],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={BrandAssets.mascotTransparent}
          style={{ width: 88, height: 88 }}
          contentFit="contain"
          accessibilityLabel=""
        />
        <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
          Meet Budget Buddy
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Create a free account to chat with Budget Buddy and scan receipts or your pantry.
        </ThemedText>
        <Button
          label="Create an account"
          variant="panel"
          onPress={() => {
            onNavigate?.();
            router.push('/sign-up');
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Space[4], gap: Space[3] }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', gap: Space[3], alignItems: 'center' }}>
          <Image
            source={BrandAssets.mascotTransparent}
            style={{ width: 48, height: 48 }}
            contentFit="contain"
            accessibilityLabel=""
          />
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            Ask me anything about your budget — I&rsquo;ll keep it simple.
          </ThemedText>
        </View>

        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <View
              key={message.id}
              accessibilityLabel={`${isUser ? 'You' : 'Budget Buddy'}: ${message.content}`}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                backgroundColor: isUser ? theme.primary : theme.budgetBuddyMuted,
                borderRadius: Radius.smallCard,
                borderBottomRightRadius: isUser ? 4 : Radius.smallCard,
                borderBottomLeftRadius: isUser ? Radius.smallCard : 4,
                paddingVertical: Space[3],
                paddingHorizontal: Space[4],
              }}
            >
              <ThemedText
                type="small"
                themeColor={isUser ? 'onPrimary' : 'text'}
                style={{ lineHeight: 22 }}
              >
                {message.content}
              </ThemedText>
            </View>
          );
        })}

        {isSending ? (
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            Budget Buddy is thinking…
          </ThemedText>
        ) : null}

        {messages.length === 0 ? (
          <View style={{ gap: Space[2] }}>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Pressable
                key={prompt}
                accessibilityRole="button"
                accessibilityLabel={`Ask: ${prompt}`}
                disabled={!gate?.allowed || isSending || voiceBusy}
                onPress={() => sendTyped(prompt)}
                style={({ pressed }) => ({
                  minHeight: Layout.minimumTouchTarget,
                  justifyContent: 'center',
                  paddingVertical: Space[2],
                  paddingHorizontal: Space[4],
                  borderRadius: Radius.input,
                  backgroundColor: pressed ? theme.backgroundSelected : theme.budgetBuddyMuted,
                  opacity: gate?.allowed ? 1 : 0.55,
                })}
              >
                <ThemedText type="smallBold">{prompt}</ThemedText>
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[1] }}>
              {SHORTCUTS.map((s) => (
                <Button key={s.href} label={s.label} variant="quiet" onPress={() => go(s.href)} />
              ))}
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <Button label="Clear chat" variant="quiet" onPress={chat.clear} />
          </View>
        )}
      </ScrollView>

      <View
        style={{
          padding: Space[4],
          gap: Space[2],
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}
      >
        {blocked && gate?.reason ? <LimitNotice reason={gate.reason} /> : null}
        {chat.limitReason ? <LimitNotice reason={chat.limitReason} /> : null}
        {chat.errorMessage ? (
          <ThemedText type="small" themeColor="warning" accessibilityLiveRegion="polite">
            {chat.errorMessage}
          </ThemedText>
        ) : null}
        {chat.gateFailed && !gate ? (
          <ThemedText type="small" themeColor="warning">
            We couldn&rsquo;t check your Budget Buddy allowance just now. Close and reopen to retry.
          </ThemedText>
        ) : gate?.kind === 'count' && gate.remaining !== undefined && gate.allowed ? (
          <ThemedText type="small" themeColor="textSecondary">
            {gate.remaining} message{gate.remaining === 1 ? '' : 's'} left
          </ThemedText>
        ) : null}

        <BuddyVoiceControls voice={voice} />

        <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'flex-end' }}>
          <TextInput
            accessibilityLabel="Message Budget Buddy"
            value={draft}
            onChangeText={chat.setDraft}
            placeholder="Ask about your money"
            placeholderTextColor={theme.textSecondary}
            multiline
            editable={!!gate?.allowed}
            onKeyPress={(event) => {
              const native = event.nativeEvent as unknown as { key: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey) {
                event.preventDefault();
                if (canSend) sendTyped();
              }
            }}
            style={{
              flex: 1,
              minHeight: Layout.controlHeight,
              maxHeight: 120,
              borderWidth: 1.5,
              borderColor: theme.controlBorder,
              borderRadius: Radius.input,
              paddingHorizontal: Space[3],
              paddingVertical: Space[3],
              fontFamily: Fonts.body.regular,
              fontSize: 17,
              color: theme.text,
              backgroundColor: theme.backgroundElement,
            }}
          />
          <Button
            label={isSending ? 'Sending…' : 'Send'}
            onPress={() => sendTyped()}
            disabled={!canSend}
          />
        </View>
        <ThemedText type="small" themeColor="caption" style={{ fontSize: 13, lineHeight: 18 }}>
          Budget Buddy shares educational budgeting help, not financial, tax, legal or investment
          advice.
        </ThemedText>
      </View>
    </View>
  );
}
