import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface OnboardingStepperProps {
  /** Short label under each step's circle — keep to one or two words. */
  labels: string[];
  /** 0-indexed. */
  currentStep: number;
}

/** The progress bar + numbered step row at the top of the onboarding wizard. */
export function OnboardingStepper({ labels, currentStep }: OnboardingStepperProps) {
  const theme = useTheme();
  const percent = ((currentStep + 1) / labels.length) * 100;

  return (
    <View style={{ gap: Space[3] }}>
      <ProgressBar percent={percent} />
      <View style={{ flexDirection: 'row' }}>
        {labels.map((label, index) => {
          const isDone = index < currentStep;
          const isActive = index === currentStep;
          const isFilled = isDone || isActive;

          return (
            <View key={label} style={{ flex: 1, alignItems: 'center', gap: Space[1] }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: Radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isFilled ? theme.primary : theme.backgroundSelected,
                }}
              >
                <ThemedText
                  type="smallBold"
                  style={{
                    fontSize: 13,
                    color: isFilled ? theme.onPrimary : theme.textSecondary,
                  }}
                >
                  {isDone ? '✓' : index + 1}
                </ThemedText>
              </View>
              <ThemedText
                type="small"
                themeColor={isActive ? 'primary' : 'textSecondary'}
                style={{ textAlign: 'center' }}
                numberOfLines={1}
              >
                {label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
