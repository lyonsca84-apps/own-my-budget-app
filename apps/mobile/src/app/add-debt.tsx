import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  createDebt,
  getDebt,
  updateDebt,
  type Tables,
  type TablesUpdate,
} from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { CARD_NETWORKS, CARD_STYLES, DEFAULT_CARD_STYLE_KEY } from '@/components/bills/card-style';
import { formatDollarsInput, parseDollarsToCents } from '@/components/bills/common';
import { CreditCardFace } from '@/components/bills/credit-card-face';
import { LOAN_TYPE_LABELS } from '@/components/bills/view-models';
import { Button } from '@/components/ui/button';
import { DateField, isValidIsoDate } from '@/components/ui/date-field';
import { DialogScreen } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useDataUser } from '@/contexts/auth-context';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const LOAN_TYPES = ['mortgage', 'heloc', 'personalLoan', 'autoLoan', 'studentLoan', 'other'];
const TEXT_MODES = [
  { value: 'auto', label: 'Automatic' },
  { value: 'light', label: 'Light text' },
  { value: 'dark', label: 'Dark text' },
];
const LOAN_TYPE_OPTIONS = LOAN_TYPES.map((value) => ({ value, label: LOAN_TYPE_LABELS[value] }));
const NETWORK_OPTIONS = CARD_NETWORKS.map((value) => ({ value, label: value }));
const twoUp = { flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] } as const;
const half = { flexGrow: 1, flexBasis: 200 } as const;

/** Empty string -> null; otherwise trimmed text. */
const textOrNull = (value: string) => value.trim() || null;
const percentToBps = (value: string) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

/**
 * Add or edit a credit card / loan / mortgage. `kind` = 'card' | 'loan'
 * chooses the form's shape when adding; `debtId` switches to edit mode
 * (balance is then changed through Manage payments, not here).
 */
export default function AddDebtScreen() {
  const theme = useTheme();
  const { userId } = useDataUser();
  const { kind, debtId } = useLocalSearchParams<{ kind?: 'card' | 'loan'; debtId?: string }>();
  const isEdit = !!debtId;

  const [original, setOriginal] = useState<Tables<'debts'> | null>(null);
  const [label, setLabel] = useState('');
  const [type, setType] = useState(kind === 'loan' ? 'personalLoan' : 'creditCard');
  const [issuer, setIssuer] = useState('');
  const [last4, setLast4] = useState('');
  const [network, setNetwork] = useState('Not specified');
  const [cardStyle, setCardStyle] = useState<string>(DEFAULT_CARD_STYLE_KEY);
  const [styleTouched, setStyleTouched] = useState(false);
  const [textMode, setTextMode] = useState('auto');
  const [balance, setBalance] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [plannedPayment, setPlannedPayment] = useState('');
  const [apr, setApr] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [promoBalance, setPromoBalance] = useState('');
  const [promoApr, setPromoApr] = useState('');
  const [promoExpires, setPromoExpires] = useState('');
  const [lender, setLender] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [startedOn, setStartedOn] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCard = type === 'creditCard';

  useEffect(() => {
    if (!debtId) return;
    let mounted = true;
    getDebt(supabase, debtId)
      .then((row) => {
        if (!mounted) return;
        setOriginal(row);
        setLabel(row.label);
        setType(row.type);
        setIssuer(row.issuer ?? '');
        setLast4(row.last4 ?? '');
        setNetwork(row.network ?? 'Not specified');
        setCardStyle(row.card_style ?? DEFAULT_CARD_STYLE_KEY);
        setTextMode(row.card_text_mode ?? 'auto');
        setOriginalAmount(formatDollarsInput(row.original_balance_cents ?? null));
        setCreditLimit(formatDollarsInput(row.credit_limit_cents));
        setMinimumPayment(formatDollarsInput(row.minimum_payment_cents || null));
        setPlannedPayment(formatDollarsInput(row.planned_payment_cents ?? null));
        setApr(row.apr_basis_points ? String(row.apr_basis_points / 100) : '');
        setDueDay(row.due_day ? String(row.due_day) : '');
        setPromoBalance(formatDollarsInput(row.promo_balance_cents ?? null));
        setPromoApr(row.promo_apr_basis_points ? String(row.promo_apr_basis_points / 100) : '');
        setPromoExpires(row.promo_expires_on ?? '');
        setLender(row.lender ?? '');
        setTermMonths(row.term_months ? String(row.term_months) : '');
        setStartedOn(row.started_on ?? '');
        setNotes(row.notes ?? '');
      })
      .catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "We couldn't load this account.")
      );
    return () => {
      mounted = false;
    };
  }, [debtId]);

  function validate(): string | null {
    if (!label.trim()) return 'Give this account a name.';
    if (!isEdit) {
      const cents = parseDollarsToCents(balance);
      if (cents === null) return 'Enter a valid current balance.';
    }
    if (last4.trim() && !/^\d{4}$/.test(last4.trim()))
      return 'Last four digits must be exactly 4 numbers.';
    if (dueDay.trim()) {
      const day = Number(dueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) return 'Due day must be between 1 and 31.';
    }
    if (promoExpires.trim() && !isValidIsoDate(promoExpires.trim()))
      return 'Choose a valid promo expiration date.';
    if (startedOn.trim() && !isValidIsoDate(startedOn.trim())) return 'Choose a valid start date.';
    if (termMonths.trim() && !(Number(termMonths) > 0))
      return 'Loan term must be a number of months.';
    return null;
  }

  async function handleSave() {
    if (!userId) return;
    const problem = validate();
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const core = {
      label: label.trim(),
      type,
      apr_basis_points: percentToBps(apr) ?? 0,
      minimum_payment_cents: parseDollarsToCents(minimumPayment) ?? 0,
      credit_limit_cents: isCard ? parseDollarsToCents(creditLimit) : null,
      due_day: dueDay.trim() ? Number(dueDay) : null,
    };
    // Details beyond the original schema (migration 20260920100000). Sent
    // only when meaningful so saving still works on an un-migrated database.
    const extras: Record<string, unknown> = {
      planned_payment_cents: parseDollarsToCents(plannedPayment),
      notes: textOrNull(notes),
      ...(isCard
        ? {
            issuer: textOrNull(issuer),
            last4: textOrNull(last4),
            network: network === 'Not specified' ? null : network,
            promo_balance_cents: parseDollarsToCents(promoBalance),
            promo_apr_basis_points: percentToBps(promoApr),
            promo_expires_on: textOrNull(promoExpires),
            ...(isEdit || styleTouched ? { card_style: cardStyle } : {}),
            ...(isEdit || textMode !== 'auto' ? { card_text_mode: textMode } : {}),
          }
        : {
            lender: textOrNull(lender),
            term_months: termMonths.trim() ? Math.round(Number(termMonths)) : null,
            started_on: textOrNull(startedOn),
            original_balance_cents: parseDollarsToCents(originalAmount),
          }),
    };

    try {
      if (isEdit && debtId) {
        const before = original as unknown as Record<string, unknown> | null;
        const changedExtras = Object.fromEntries(
          Object.entries(extras).filter(([key, value]) => (before?.[key] ?? null) !== value)
        );
        await saveWithFallback(
          () =>
            updateDebt(supabase, debtId, { ...core, ...changedExtras } as TablesUpdate<'debts'>),
          () => updateDebt(supabase, debtId, core),
          Object.keys(changedExtras).length > 0
        );
      } else {
        const balanceCents = parseDollarsToCents(balance) ?? 0;
        const populated = Object.fromEntries(
          Object.entries(extras).filter(([, value]) => value !== null && value !== undefined)
        );
        const base = { user_id: userId, balance_cents: balanceCents, ...core };
        await saveWithFallback(
          () =>
            createDebt(supabase, {
              ...base,
              // Starting balance lets progress-to-paid-off be measured later.
              ...(isCard ? {} : { original_balance_cents: balanceCents }),
              ...populated,
            } as Parameters<typeof createDebt>[1]),
          () => createDebt(supabase, base),
          true
        );
      }
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = `${isEdit ? 'Edit' : 'Add'} ${isCard ? 'credit card' : 'loan or mortgage'}`;

  return (
    <DialogScreen
      title={title}
      subtitle={
        isEdit
          ? isCard
            ? 'Update this card’s details.'
            : 'Update this account’s details.'
          : isCard
            ? 'Add a new credit card.'
            : 'Add a new loan or mortgage.'
      }
      primaryLabel={isEdit ? 'Save changes' : isCard ? 'Add card' : 'Add account'}
      onPrimary={handleSave}
      primaryDisabled={!label.trim() || (isEdit && !original)}
      busy={isSubmitting}
      errorMessage={errorMessage}
      size="lg"
    >
      <View style={{ gap: Space[3] }}>
        <TextField
          label={isCard ? 'Card name' : 'Account name'}
          value={label}
          onChangeText={setLabel}
          placeholder={isCard ? 'e.g. Everyday Visa' : 'e.g. Home mortgage'}
          autoFocus
        />

        {isCard ? (
          <>
            <View style={twoUp}>
              {!isEdit ? (
                <View style={half}>
                  <TextField
                    label="Current balance"
                    value={balance}
                    onChangeText={setBalance}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
              ) : null}
              <View style={half}>
                <TextField
                  label="Credit limit"
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={twoUp}>
              <View style={half}>
                <TextField
                  label="Min payment"
                  value={minimumPayment}
                  onChangeText={setMinimumPayment}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={half}>
                <TextField
                  label="APR %"
                  value={apr}
                  onChangeText={setApr}
                  placeholder="e.g. 23.99"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            {isEdit ? (
              <>
                <View style={twoUp}>
                  <View style={half}>
                    <TextField
                      label="Due day of the month (1–31)"
                      value={dueDay}
                      onChangeText={setDueDay}
                      placeholder="e.g. 15"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={half}>
                    <TextField
                      label="Planned payment"
                      value={plannedPayment}
                      onChangeText={setPlannedPayment}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={twoUp}>
                  <View style={half}>
                    <TextField
                      label="Promo balance"
                      value={promoBalance}
                      onChangeText={setPromoBalance}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={half}>
                    <TextField
                      label="Promo APR %"
                      value={promoApr}
                      onChangeText={setPromoApr}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <DateField
                  label="Promo expiration"
                  value={promoExpires}
                  onChange={setPromoExpires}
                />
                <TextField
                  label="Notes"
                  hideLabel
                  placeholder="Notes"
                  rows={3}
                  value={notes}
                  onChangeText={setNotes}
                />
              </>
            ) : null}

            <View
              style={{
                gap: Space[3],
                paddingTop: Space[4],
                marginTop: Space[2],
                borderTopWidth: 1,
                borderTopColor: theme.border,
              }}
            >
              <ThemedText type="smallBold">Card appearance</ThemedText>
              <View
                accessible
                accessibilityLabel="Card preview"
                style={{ maxWidth: 320, width: '100%' }}
              >
                <CreditCardFace
                  name={label}
                  issuer={issuer}
                  last4={last4}
                  network={network}
                  cardStyle={cardStyle}
                  cardTextMode={textMode}
                  balanceCents={parseDollarsToCents(balance) ?? original?.balance_cents ?? 0}
                  utilizationPercent={null}
                  compact
                />
              </View>
              <TextField
                label="Bank or issuer"
                hideLabel
                value={issuer}
                onChangeText={setIssuer}
                placeholder="Bank or issuer (e.g. Bank of America)"
              />
              <View style={twoUp}>
                <View style={half}>
                  <TextField
                    label="Last 4 digits"
                    hideLabel
                    value={last4}
                    onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    placeholder="Last 4 digits"
                  />
                </View>
                <View style={half}>
                  <SelectField
                    label="Card network"
                    hideLabel
                    value={network}
                    onChange={setNetwork}
                    options={NETWORK_OPTIONS}
                  />
                </View>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Never enter a full card number, CVV or PIN. Only the last four digits are stored.
              </ThemedText>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Preset styles
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
                {CARD_STYLES.map((style) => {
                  const selected = style.key === cardStyle;
                  const colors =
                    style.colors.length === 2
                      ? style.colors
                      : ([style.colors[0], style.colors[0]] as const);
                  return (
                    <Pressable
                      key={style.key}
                      accessibilityRole="button"
                      accessibilityLabel={style.label}
                      aria-pressed={selected}
                      onPress={() => {
                        setCardStyle(style.key);
                        setStyleTouched(true);
                      }}
                      style={{
                        width: 56,
                        height: 44,
                        borderRadius: Radius.input,
                        borderWidth: 3,
                        borderColor: selected ? theme.panel : 'transparent',
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LinearGradient
                        colors={colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: '100%', height: '100%' }}
                      />
                      {selected ? (
                        <ThemedText style={{ position: 'absolute', color: theme.onPanel }}>
                          ✓
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Text color
              </ThemedText>
              <SegmentedControl
                variant="soft"
                size="sm"
                accessibilityLabel="Card text color"
                options={TEXT_MODES}
                value={textMode}
                onChange={setTextMode}
              />
              <View style={{ alignSelf: 'flex-start' }}>
                <Button
                  label="Reset to recommended style"
                  variant="quiet"
                  size="sm"
                  onPress={() => {
                    setCardStyle(DEFAULT_CARD_STYLE_KEY);
                    setStyleTouched(true);
                    setTextMode('auto');
                  }}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={twoUp}>
              <View style={half}>
                <SelectField
                  label="Account type"
                  value={type}
                  onChange={setType}
                  options={LOAN_TYPE_OPTIONS}
                />
              </View>
              <View style={half}>
                <TextField
                  label="Lender"
                  value={lender}
                  onChangeText={setLender}
                  placeholder="e.g. Riverside Credit Union"
                />
              </View>
            </View>
            <View style={twoUp}>
              {!isEdit ? (
                <View style={half}>
                  <TextField
                    label="Current balance"
                    value={balance}
                    onChangeText={setBalance}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
              ) : (
                <View style={half}>
                  <TextField
                    label="Original amount"
                    value={originalAmount}
                    onChangeText={setOriginalAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
              <View style={half}>
                <TextField
                  label="Monthly payment"
                  value={minimumPayment}
                  onChangeText={setMinimumPayment}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={twoUp}>
              <View style={half}>
                <TextField
                  label="APR %"
                  value={apr}
                  onChangeText={setApr}
                  placeholder="e.g. 6.5"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={half}>
                <TextField
                  label="Loan term (months)"
                  value={termMonths}
                  onChangeText={setTermMonths}
                  placeholder="e.g. 360"
                  keyboardType="number-pad"
                />
              </View>
            </View>
            {isEdit ? (
              <View style={twoUp}>
                <View style={half}>
                  <DateField label="Start date" value={startedOn} onChange={setStartedOn} />
                </View>
                <View style={half}>
                  <TextField
                    label="Due day of the month (1–31)"
                    value={dueDay}
                    onChangeText={setDueDay}
                    placeholder="e.g. 15"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ) : null}
            {isEdit ? (
              <TextField
                label="Notes"
                hideLabel
                placeholder="Notes"
                rows={3}
                value={notes}
                onChangeText={setNotes}
              />
            ) : null}
          </>
        )}
        {isEdit ? (
          <ThemedText type="small" themeColor="textSecondary">
            To change the balance, use Manage payments — it keeps your payment history accurate.
          </ThemedText>
        ) : null}
      </View>
    </DialogScreen>
  );
}

/**
 * Tries the full save; if the database rejects it only because the newer
 * columns don't exist yet (migration not applied), saves the core fields so
 * the user is never blocked from adding or editing an account.
 */
async function saveWithFallback(
  full: () => Promise<unknown>,
  core: () => Promise<unknown>,
  hasExtras: boolean
) {
  try {
    await full();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String((error as { message?: string })?.message ?? '');
    if (hasExtras && /column|schema cache/i.test(message)) {
      await core();
      return;
    }
    throw error;
  }
}
