import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { listDebtsWithPayments } from '@own-my-budget/api';

import { CardFullDetails } from '@/components/bills/card-details';
import { debtItemFromRow, type DebtItem } from '@/components/bills/view-models';
import { DialogScreen } from '@/components/ui/dialog';
import { ThemedText } from '@/components/themed-text';
import { useDataUser } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/** "View details" for a credit card — every fact tracked about it. No full account numbers are stored. */
export default function CardDetailsScreen() {
  const { userId, isReady } = useDataUser();
  const { debtId } = useLocalSearchParams<{ debtId: string }>();
  const [card, setCard] = useState<DebtItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !userId || !debtId) return;
    let mounted = true;
    listDebtsWithPayments(supabase, userId)
      .then((rows) => {
        const row = rows.find((r) => r.id === debtId);
        if (!mounted) return;
        if (row) setCard(debtItemFromRow(row, new Date()));
        else setErrorMessage('We could not find that card.');
      })
      .catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "We couldn't load this card.")
      );
    return () => {
      mounted = false;
    };
  }, [isReady, userId, debtId]);

  return (
    <DialogScreen
      title={card ? `${card.label} — details` : 'Card details'}
      subtitle="Tracking details for this account. No full account numbers are stored."
      primaryLabel="Close"
      onPrimary={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      secondaryLabel={null}
      errorMessage={errorMessage}
    >
      {card ? (
        <CardFullDetails
          card={card}
          onEdit={() => router.replace({ pathname: '/add-debt', params: { debtId: card.id } })}
        />
      ) : (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      )}
    </DialogScreen>
  );
}
