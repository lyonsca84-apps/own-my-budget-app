import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/button';
import { Space } from '@/constants/theme';
import { MONTH_NAMES } from '@/components/budget/use-budget-data';

export interface MonthYearPickerProps {
  month: number; // 0-11
  year: number;
  onChange: (month: number, year: number) => void;
  disabled?: boolean;
}

/**
 * Month + year steppers. Stepping the month past December/January carries the
 * year with it, so "next" from December always lands where you'd expect.
 */
export function MonthYearPicker({ month, year, onChange, disabled }: MonthYearPickerProps) {
  function stepMonth(delta: number) {
    const next = month + delta;
    if (next < 0) onChange(11, year - 1);
    else if (next > 11) onChange(0, year + 1);
    else onChange(next, year);
  }

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Budget period"
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[3] }}
    >
      <Stepper
        label={MONTH_NAMES[month]}
        noun="month"
        minWidth={104}
        disabled={disabled}
        onPrev={() => stepMonth(-1)}
        onNext={() => stepMonth(1)}
      />
      <Stepper
        label={String(year)}
        noun="year"
        minWidth={56}
        disabled={disabled}
        onPrev={() => onChange(month, year - 1)}
        onNext={() => onChange(month, year + 1)}
      />
    </View>
  );
}

function Stepper({
  label,
  noun,
  minWidth,
  disabled,
  onPrev,
  onNext,
}: {
  label: string;
  noun: string;
  minWidth: number;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[1] }}>
      <IconButton accessibilityLabel={`Previous ${noun}`} onPress={onPrev} disabled={disabled}>
        <ThemedText type="smallBold">‹</ThemedText>
      </IconButton>
      <ThemedText
        type="smallBold"
        accessibilityLiveRegion="polite"
        style={{ minWidth, textAlign: 'center' }}
      >
        {label}
      </ThemedText>
      <IconButton accessibilityLabel={`Next ${noun}`} onPress={onNext} disabled={disabled}>
        <ThemedText type="smallBold">›</ThemedText>
      </IconButton>
    </View>
  );
}
