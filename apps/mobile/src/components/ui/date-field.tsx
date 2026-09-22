import { useState } from 'react';

import { isValidIsoDate, type DateFieldProps } from '@/components/ui/date-field-types';
import { TextField } from '@/components/ui/text-field';

export { isValidIsoDate, type DateFieldProps } from '@/components/ui/date-field-types';

/**
 * Native date input: a `YYYY-MM-DD` text field that validates on blur (no
 * native date-picker dependency is installed, and adding one needs a native
 * rebuild). On web `date-field.web.tsx` renders a real `<input type="date">`.
 */
export function DateField({
  label,
  hideLabel,
  value,
  onChange,
  errorMessage,
  disabled,
}: DateFieldProps) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && value !== '' && !isValidIsoDate(value);

  return (
    <TextField
      label={label}
      hideLabel={hideLabel}
      value={value}
      onChangeText={onChange}
      onBlur={() => setTouched(true)}
      placeholder="YYYY-MM-DD"
      keyboardType="numbers-and-punctuation"
      maxLength={10}
      editable={!disabled}
      autoCorrect={false}
      errorMessage={errorMessage ?? (invalid ? 'Use the format YYYY-MM-DD.' : undefined)}
    />
  );
}
