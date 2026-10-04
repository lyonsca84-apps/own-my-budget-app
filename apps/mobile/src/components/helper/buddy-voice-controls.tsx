import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Layout, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { BuddyVoice, BuddyVoicePhase } from './use-buddy-voice';

const STATUS_LABEL: Record<BuddyVoicePhase, string> = {
  ready: 'Ready',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface BuddyVoiceControlsProps {
  voice: BuddyVoice;
}

/**
 * The tap-to-talk row inside the Budget Buddy composer. Exactly one set of
 * actions shows at a time, matching the current state, so there is never a
 * way to start a second recording or overlap two replies. Every control is
 * a real button (keyboard-focusable, Enter/Space to press) at the app's
 * minimum touch size or larger.
 */
export function BuddyVoiceControls({ voice }: BuddyVoiceControlsProps) {
  const theme = useTheme();
  if (!voice.visible) return null;

  const { phase } = voice;
  const working = phase === 'transcribing' || phase === 'thinking';
  const idle = phase === 'ready';

  return (
    <View style={{ gap: Space[2] }}>
      {voice.notice ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {voice.notice}
        </ThemedText>
      ) : null}

      {voice.error ? (
        <View style={{ gap: Space[1] }}>
          <ThemedText type="small" themeColor="warning" accessibilityLiveRegion="polite">
            {voice.error.message}
          </ThemedText>
          {voice.error.recovery ? (
            <View style={{ flexDirection: 'row' }}>
              <Button
                label={voice.error.recovery === 'record' ? 'Try again' : 'Try voice again'}
                variant="quiet"
                onPress={voice.recover}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[2] }}>
        {phase === 'listening' ? (
          <>
            <Button
              label="Done"
              accessibilityLabel="Done talking — send to Budget Buddy"
              onPress={voice.done}
            />
            <Button label="Cancel recording" variant="outline" onPress={voice.cancel} />
          </>
        ) : null}

        {working ? (
          <Button
            label="Cancel"
            accessibilityLabel="Cancel this voice message"
            variant="outline"
            onPress={voice.cancel}
          />
        ) : null}

        {phase === 'speaking' ? (
          <Button label="Stop audio" variant="outline" onPress={voice.stopAudio} />
        ) : null}

        {idle && voice.canTalk ? (
          <Button
            label="Talk to Buddy"
            accessibilityLabel="Talk to Buddy — record a spoken question"
            variant="outline"
            onPress={voice.start}
          />
        ) : null}

        {idle && voice.needsTapToPlay ? (
          <Button
            label="Play reply"
            accessibilityLabel="Play Budget Buddy’s spoken reply"
            onPress={voice.replay}
          />
        ) : null}
        {idle && !voice.needsTapToPlay && voice.hasAudio ? (
          <Button
            label="Replay"
            accessibilityLabel="Replay Budget Buddy’s spoken reply"
            variant="quiet"
            onPress={voice.replay}
          />
        ) : null}
        {idle && voice.canListen ? (
          <Button
            label="Listen"
            accessibilityLabel="Listen to Budget Buddy’s latest reply"
            variant="quiet"
            onPress={voice.replay}
          />
        ) : null}

        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}
        >
          <ThemedText type="smallBold">{STATUS_LABEL[phase]}</ThemedText>
          {phase === 'listening' ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              accessibilityLabel={`Recording, ${voice.elapsedSeconds} of ${voice.maxSeconds} seconds`}
              // The clock ticks every second; only the state changes are announced.
              accessibilityLiveRegion="none"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatClock(voice.elapsedSeconds)} / {formatClock(voice.maxSeconds)}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {voice.canSpeak ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Spoken replies"
          accessibilityState={{ checked: voice.spokenReplies }}
          onPress={() => voice.setSpokenReplies(!voice.spokenReplies)}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            minHeight: Layout.minimumTouchTarget,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Space[2],
            paddingHorizontal: Space[3],
            borderRadius: Radius.input,
            borderWidth: 1.5,
            borderColor: theme.controlBorder,
            backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
          })}
        >
          <ThemedText type="small">Spoken replies</ThemedText>
          <ThemedText
            type="smallBold"
            themeColor={voice.spokenReplies ? 'primary' : 'textSecondary'}
          >
            {voice.spokenReplies ? 'On' : 'Off'}
          </ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="small" themeColor="caption" style={{ fontSize: 13, lineHeight: 18 }}>
        Budget Buddy uses an AI-generated voice.
      </ThemedText>
    </View>
  );
}
