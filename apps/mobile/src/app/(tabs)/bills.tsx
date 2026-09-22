import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BillsTab } from '@/components/bills/bills-tab';
import { CardsTab } from '@/components/bills/cards-tab';
import { exportCardsToCsv } from '@/components/bills/cards-csv';
import { LoansTab } from '@/components/bills/loans-tab';
import { PayoffTab } from '@/components/bills/payoff-tab';
import { useBillsDebtData } from '@/components/bills/use-bills-debt-data';
import type { BillItem, DebtItem } from '@/components/bills/view-models';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { PageTabs } from '@/components/ui/segmented-control';
import { Space } from '@/constants/theme';

type BillsSubTab = 'bills' | 'cards' | 'loans' | 'payoff';

const TABS: { value: BillsSubTab; label: string }[] = [
  { value: 'bills', label: 'Bills' },
  { value: 'cards', label: 'Credit Cards' },
  { value: 'loans', label: 'Loans & Mortgages' },
  { value: 'payoff', label: 'Payoff Plan' },
];

/**
 * Bills & Debt — four views (Bills, Credit Cards, Loans & Mortgages, Payoff
 * Plan) over the user's data. Guests run exactly the same code against the
 * in-memory sample database, so every control works for them too.
 */
export default function BillsScreen() {
  const data = useBillsDebtData();
  const [tab, setTab] = useState<BillsSubTab>('bills');

  const addBill = () => router.push('/add-bill');
  const addCard = () => router.push({ pathname: '/add-debt', params: { kind: 'card' } });
  const addLoan = () => router.push({ pathname: '/add-debt', params: { kind: 'loan' } });

  const editDebt = (debt: DebtItem) =>
    router.push({ pathname: '/add-debt', params: { debtId: debt.id } });
  const manageDebt = (debt: DebtItem) =>
    router.push({ pathname: '/record-debt-payment', params: { debtId: debt.id } });
  const planDebt = (debt: DebtItem) =>
    router.push({
      pathname: '/plan-payment',
      params: { targetType: 'debt', targetId: debt.id },
    });
  const cardDetails = (debt: DebtItem) =>
    router.push({ pathname: '/card-details', params: { debtId: debt.id } });

  const logBill = (bill: BillItem) =>
    router.push({
      pathname: '/record-bill-payment',
      params: {
        billId: bill.id,
        amountCents: String(bill.remainingCents > 0 ? bill.remainingCents : bill.amountCents),
      },
    });
  const planBill = (bill: BillItem) =>
    router.push({
      pathname: '/plan-payment',
      params: { targetType: 'bill', targetId: bill.id },
    });

  return (
    <Screen showGuestBanner>
      <PageHeader
        title="Bills & Debt"
        subtitle="Bills, cards, loans and your payoff plan."
        right={
          tab === 'bills' ? (
            <Button label="+ Add bill" size="sm" shape="rounded" onPress={addBill} />
          ) : undefined
        }
      />

      <PageTabs
        accessibilityLabel="Bills and debt views"
        options={TABS}
        value={tab}
        onChange={setTab}
      />

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
            onAddBill={addBill}
            onLogPayment={logBill}
            onPlanPayment={planBill}
            onToggleReminder={(bill, enabled) => data.setBillReminder(bill.id, enabled)}
          />
        ) : null}
        {tab === 'cards' ? (
          <CardsTab
            cards={data.cards}
            plans={data.plans}
            prefs={data.prefs}
            isLoading={data.isLoading}
            onAddCard={addCard}
            onEditCard={editDebt}
            onViewDetails={cardDetails}
            onManagePayments={manageDebt}
            onPlanPayment={planDebt}
            onRemoveCard={(card) => data.removeDebt(card.id)}
            onSavePrefs={data.savePrefs}
            onExportCsv={() => exportCardsToCsv(data.cards)}
          />
        ) : null}
        {tab === 'loans' ? (
          <LoansTab
            loans={data.loans}
            plans={data.plans}
            isLoading={data.isLoading}
            onAddLoan={addLoan}
            onEditLoan={editDebt}
            onManagePayments={manageDebt}
            onPlanPayment={planDebt}
            onRemoveLoan={(loan) => data.removeDebt(loan.id)}
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
