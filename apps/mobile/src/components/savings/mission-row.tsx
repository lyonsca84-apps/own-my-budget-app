import { View } from 'react-native';
import type { MissionStatus } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { Space } from '@/constants/theme';

export interface MissionRowProps {
  mission: MissionStatus;
  onComplete: () => void;
  /** Guests can look but not change anything. */
  disabled?: boolean;
}

/** A Budget Mission: title, percent, progress bar, and either "Mark complete", a Done pill, or an "auto-tracked" note. */
export function MissionRow({ mission, onComplete, disabled }: MissionRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: Space[3],
      }}
    >
      <View style={{ flexGrow: 1, flexBasis: 220, gap: Space[2] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Space[3] }}>
          <ThemedText type="smallBold" style={{ flexShrink: 1 }}>
            {mission.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {mission.progress}%
          </ThemedText>
        </View>
        <ProgressBar percent={mission.progress} tone={mission.done ? 'success' : 'primary'} />
        <ThemedText type="small" themeColor="textSecondary">
          {mission.description}
        </ThemedText>
      </View>
      {mission.done ? (
        <StatusPill label="Done" tone="success" />
      ) : mission.manual ? (
        <Button
          label="Mark complete"
          variant="secondary"
          onPress={onComplete}
          disabled={disabled}
          accessibilityLabel={`Mark complete: ${mission.title}`}
        />
      ) : (
        <StatusPill label="Tracked automatically" tone="neutral" />
      )}
    </View>
  );
}
