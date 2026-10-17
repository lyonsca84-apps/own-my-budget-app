import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/contexts/auth-context';

/**
 * Face ID / passcode app-lock (PLAN.md screen #68) is deliberately not
 * built here — it's a real native biometric feature (expo-local-
 * authentication) that can't be meaningfully verified without a physical
 * device or a simulator with biometrics enrolled, unlike everything else
 * built this phase. Change password is the part of "Security" that's
 * fully testable in this environment.
 */
export default function SecurityScreen() {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit() {
    setStatusMessage(null);
    setIsSubmitting(true);
    const { error } = await updatePassword(newPassword);
    setIsSubmitting(false);
    if (error) {
      setIsError(true);
      setStatusMessage(error);
    } else {
      setIsError(false);
      setStatusMessage('Password updated.');
      setNewPassword('');
    }
  }

  return (
    <Screen>
      <SectionCard title="Change password">
        <TextField
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        {statusMessage ? (
          <ThemedText themeColor={isError ? 'danger' : 'success'}>{statusMessage}</ThemedText>
        ) : null}
        <Button
          label={isSubmitting ? 'Saving…' : 'Update password'}
          onPress={handleSubmit}
          disabled={isSubmitting || newPassword.length < 6}
        />
      </SectionCard>
    </Screen>
  );
}
