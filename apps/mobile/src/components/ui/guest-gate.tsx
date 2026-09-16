import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

export interface GuestGateProps {
  title: string;
  message: string;
}

/**
 * The full-tab "this needs a real account" gate shown to guests on sections
 * that require their own data (Plan, Bills, Money, Helper, Grocery). The
 * mascot makes this an encouraging nudge rather than a wall — never an error.
 */
export function GuestGate({ title, message }: GuestGateProps) {
  return (
    <Screen scroll={false} center>
      <EmptyState
        title={title}
        message={message}
        mascot
        action={
          <Button
            label="Create an account"
            variant="panel"
            onPress={() => router.push('/sign-up')}
          />
        }
      />
    </Screen>
  );
}
