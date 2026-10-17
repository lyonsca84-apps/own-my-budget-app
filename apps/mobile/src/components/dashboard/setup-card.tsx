import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Space } from '@/constants/theme';

import type { SetupPiece } from './model';

const PIECE_ACTIONS: Record<SetupPiece, { label: string; href: Href }> = {
  income: { label: 'Add income', href: '/add-income' },
  bills: { label: 'Add a bill', href: '/add-bill' },
  debts: { label: 'Add a debt', href: '/add-debt' },
  goals: { label: 'Add a savings goal', href: '/add-savings-goal' },
};

const hiddenKey = (userId: string) => `own-my-budget:setup-card-hidden:${userId}`;

export interface SetupCardProps {
  /** Nothing saved at all yet — the card can't be hidden in this state. */
  isEmpty: boolean;
  missing: SetupPiece[];
  /** Whose "Hide for now" choice to remember; null (guest) means don't remember it. */
  userId: string | null;
}

/**
 * The Dashboard's "Finish setting up your budget" prompt. Onboarding leaves
 * bills, debts and savings blank on purpose; this card offers each missing
 * piece until it exists. Once something is saved it can be hidden for now
 * (remembered on this device only), so people without debt aren't nagged.
 */
export function SetupCard({ isEmpty, missing, userId }: SetupCardProps) {
  /** The stored choice for `userId`; null until it has been read. */
  const [stored, setStored] = useState<{ userId: string; hidden: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    AsyncStorage.getItem(hiddenKey(userId))
      .then((value) => {
        if (isMounted) setStored({ userId, hidden: value === 'true' });
      })
      .catch(() => {
        if (isMounted) setStored({ userId, hidden: false });
      });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const isHidden = userId ? (stored?.userId === userId ? stored.hidden : null) : false;
  if (missing.length === 0 || isHidden === null || (isHidden && !isEmpty)) return null;

  function hide() {
    if (!userId) return;
    setStored({ userId, hidden: true });
    AsyncStorage.setItem(hiddenKey(userId), 'true').catch(() => {});
  }

  return (
    <Card style={{ alignItems: 'center', gap: Space[2], padding: Space[7] }}>
      <ThemedText type="smallBold" style={{ fontSize: 17 }} accessibilityRole="header">
        {isEmpty ? 'Let’s build your budget picture' : 'Finish setting up your budget'}
      </ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={{ textAlign: 'center', maxWidth: 420 }}
      >
        {isEmpty
          ? 'Add your income and monthly bills to see your complete budget picture.'
          : 'Add the rest whenever you’re ready. Each piece makes your dashboard more complete.'}
      </ThemedText>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: Space[2],
          marginTop: Space[2],
        }}
      >
        {missing.map((piece, index) => (
          <Button
            key={piece}
            label={PIECE_ACTIONS[piece].label}
            variant={index === 0 ? 'primary' : 'outline'}
            shape="rounded"
            onPress={() => router.push(PIECE_ACTIONS[piece].href)}
          />
        ))}
        <Button
          label="Add an expense"
          variant="outline"
          shape="rounded"
          onPress={() => router.push('/add-transaction')}
        />
      </View>
      {!isEmpty && userId ? <Button label="Hide for now" variant="quiet" onPress={hide} /> : null}
    </Card>
  );
}
