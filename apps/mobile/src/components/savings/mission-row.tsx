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
}

/** A Budget Mission: title, percent, progress bar, and either a "Done" pill or a "Mark complete" button. */
export function MissionRow({ mission, onComplete }: MissionRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: Space[3],
      }}
    >
      <View style={{ flexGrow: 1, flexBasis: 240, gap: Space[2] }}>
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
      <View style={{ minWidth: 132, alignItems: 'flex-end' }}>
        {mission.done ? (
          <StatusPill label="Done" tone="success" />
        ) : (
          <Button
            label="Mark complete"
            variant="soft"
            size="sm"
            shape="rounded"
            onPress={onComplete}
            accessibilityLabel={`Mark complete: ${mission.title}`}
          />
        )}
      </View>
    </View>
  );
}
