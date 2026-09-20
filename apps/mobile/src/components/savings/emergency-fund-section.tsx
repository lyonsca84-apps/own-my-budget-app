import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Grid } from '@/components/ui/grid';
import { SubsectionHeader } from '@/components/ui/subsection-header';
import type { GoalView } from '@/components/savings/use-savings-data';
import { Space } from '@/constants/theme';
import { BrandAssets } from '@/design-system/assets/brand';

export interface EmergencyFundSectionProps {
  goals: GoalView[];
  renderGoal: (goal: GoalView) => ReactNode;
  onStart: () => void;
}

/**
 * The emergency-fund block: the person's emergency goal(s) up front, or — when
 * there isn't one yet — an encouraging nudge to start (mascot is fine here;
 * it's encouragement, never an error state).
 */
export function EmergencyFundSection({ goals, renderGoal, onStart }: EmergencyFundSectionProps) {
  return (
    <View style={{ gap: Space[3] }}>
      <SubsectionHeader title="Emergency fund" />
      {goals.length > 0 ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            A cushion of three to six months of essential expenses keeps surprises from becoming
            setbacks.
          </ThemedText>
          <Grid>
            {goals.map((goal) => (
              <View key={goal.id} style={{ flexGrow: 1, flexBasis: 320, minWidth: 0 }}>
                {renderGoal(goal)}
              </View>
            ))}
          </Grid>
        </>
      ) : (
        <Card
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: Space[4],
          }}
        >
          <Image
            source={BrandAssets.mascotTransparent}
            style={{ width: 88, height: 88 }}
            contentFit="contain"
            accessibilityLabel=""
          />
          <View style={{ flexGrow: 1, flexBasis: 240, gap: Space[1] }}>
            <ThemedText type="subtitle">Start your emergency fund</ThemedText>
            <ThemedText themeColor="textSecondary">
              Even a small first goal counts. Pick a target — we can help you work it out from your
              monthly expenses.
            </ThemedText>
          </View>
          <Button label="Start emergency fund" variant="panel" onPress={onStart} />
        </Card>
      )}
    </View>
  );
}
