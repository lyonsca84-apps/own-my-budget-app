import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BillsTab } from '@/components/bills/bills-tab';
import { CardsTab } from '@/components/bills/cards-tab';
import { exportCardsToCsv } from '@/components/bills/cards-csv';
import { LoansTab } from '@/components/bills/loans-tab';
import { PayoffTab } from '@/components/bills/payoff-tab';
import { BillsSubTabs, type BillsSubTab } from '@/components/bills/sub-tabs';
import { useBillsDebtData } from '@/components/bills/use-bills-debt-data';
import type { BillItem, DebtItem } from '@/components/bills/view-models';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Space } from '@/constants/theme';

/**
 * Bills & Debt — four views (Bills, Credit Cards, Loans & Mortgages, Payoff
 * Plan) over real data for signed-in users and the shared demo data for
 * guests. Guests browse read-only: any action that would write sends them to
 * sign-up instead, same as the Dashboard's guest banner.
 */
export default function BillsScreen() {
  const data = useBillsDebtData();
  const [tab, setTab] = useState<BillsSubTab>('bills');

  /** Wraps a navigation so guests are invited to create an account rather than reaching a form that can't save. */
  function guarded(go: () => void) {
    return () => (data.isGuest ? router.push('/sign-up') : go());
  }

  const addAction: Record<BillsSubTab, { label: string; onPress: () => void }> = {
    bills: { label: '+ Add bill', onPress: guarded(() => router.push('/add-bill')) },
    cards: {
      label: '+ Add credit card',
      onPress: guarded(() => router.push({ pathname: '/add-debt', params: { kind: 'card' } })),
    },
    loans: {
      label: '+ Add loan',
      onPress: guarded(() => router.push({ pathname: '/add-debt', params: { kind: 'loan' } })),
    },
    payoff: {
      label: '+ Add debt',
      onPress: guarded(() => router.push('/add-debt')),
    },
  };

  const editDebt = (debt: DebtItem) =>
    guarded(() => router.push({ pathname: '/add-debt', params: { debtId: debt.id } }))();
  const manageDebt = (debt: DebtItem) =>
    guarded(() => router.push({ pathname: '/record-debt-payment', params: { debtId: debt.id } }))();
  const planDebt = (debt: DebtItem) =>
    guarded(() =>
      router.push({ pathname: '/plan-payment', params: { kind: 'debt', id: debt.id } })
    )();
  const removeDebt = async (debt: DebtItem) => {
    if (data.isGuest) {
      router.push('/sign-up');
      return;
    }
    await data.removeDebt(debt.id);
  };

  const logBill = (bill: BillItem) =>
    guarded(() =>
      router.push({
        pathname: '/record-bill-payment',
        params: { billId: bill.id, amountCents: String(bill.remainingCents) },
      })
    )();
  const planBill = (bill: BillItem) =>
    guarded(() =>
      router.push({ pathname: '/plan-payment', params: { kind: 'bill', id: bill.id } })
    )();

  return (
    <Screen showGuestBanner>
      <ScreenHeader
        title="Bills & Debt"
        subtitle="Bills, cards, loans and your payoff plan."
        action={
          <Button
            label={addAction[tab].label}
            variant="secondary"
            onPress={addAction[tab].onPress}
          />
        }
      />

      <BillsSubTabs value={tab} onChange={setTab} />

      {data.errorMessage ? (
        <ThemedText themeColor="danger" accessibilityRole="alert">
          {data.errorMessage}
        </ThemedText>
      ) : null}

      <View style={{ gap: Space[5] }}>
        {tab === 'bills' ? (
          <BillsTab
            bills={data.bills}
            plans={data.plans}
            isLoading={data.isLoading}
            onAddBill={addAction.bills.onPress}
            onLogPayment={logBill}
            onPlanPayment={planBill}
            onToggleReminder={(bill, enabled) =>
              data.isGuest ? router.push('/sign-up') : data.setBillReminder(bill.id, enabled)
            }
          />
        ) : null}
        {tab === 'cards' ? (
          <CardsTab
            cards={data.cards}
            plans={data.plans}
            prefs={data.prefs}
            isLoading={data.isLoading}
            onAddCard={addAction.cards.onPress}
            onEditCard={editDebt}
            onManagePayments={manageDebt}
            onPlanPayment={planDebt}
            onRemoveCard={removeDebt}
            onSavePrefs={data.savePrefs}
            onExportCsv={() => exportCardsToCsv(data.cards)}
          />
        ) : null}
        {tab === 'loans' ? (
          <LoansTab
            loans={data.loans}
            plans={data.plans}
            isLoading={data.isLoading}
            onAddLoan={addAction.loans.onPress}
            onEditLoan={editDebt}
            onManagePayments={manageDebt}
            onPlanPayment={planDebt}
            onRemoveLoan={removeDebt}
          />
        ) : null}
        {tab === 'payoff' ? (
          <PayoffTab
            cards={data.cards}
            loans={data.loans}
            prefs={data.prefs}
            canUseAvalanche={data.canUseAvalanche}
            isLoading={data.isLoading}
            onSavePrefs={data.savePrefs}
            onSeePlans={() => router.push('/paywall')}
          />
        ) : null}
      </View>
    </Screen>
  );
}
