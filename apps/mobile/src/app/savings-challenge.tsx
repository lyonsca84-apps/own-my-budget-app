import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CHALLENGE_MULTIPLIERS, type ChallengeBlockDetail } from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { formatActivityDate, formatMoney, formatShortDate } from '@/components/savings/format';
import { useSavingsData, type ChallengeView } from '@/components/savings/use-savings-data';
import { Button } from '@/components/ui/button';
import { closeDialogRoute, DialogScreen } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STATUS_LABEL: Record<ChallengeBlockDetail['status'], string> = {
  completed: 'Completed',
  inProgress: 'In Progress',
  notStarted: 'Not Started',
};

/**
 * The 52-week challenge dialog: multiplier, totals, and the challenge in
 * 5-week blocks — each with notes, "Mark Deposits Complete" (logs the block's
 * deposits) and "Expand weeks" (tap a single week to log or undo it).
 */
export default function SavingsChallengeScreen() {
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();
  const data = useSavingsData();
  const challenge = data.challenges.find((c) => c.goalId === goalId) ?? data.challenges[0];
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await action();
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogScreen
      title="52-Week Money Challenge"
      subtitle="Track your progress in 5-week blocks."
      size="lg"
      primaryLabel="Close"
      onPrimary={closeDialogRoute}
      errorMessage={errorMessage}
    >
      {!challenge ? (
        <ThemedText themeColor="textSecondary">
          {data.isLoading ? 'Loading your challenge…' : 'You have not started a challenge yet.'}
        </ThemedText>
      ) : (
        <ChallengeBody
          challenge={challenge}
          busy={busy}
          designSchema={data.capabilities.challengeDesign}
          onMultiplier={(multiplier) =>
            run(
              () => data.setChallengeMultiplier(challenge, multiplier),
              'Could not change the multiplier.'
            )
          }
          onNote={(index, note) =>
            run(() => data.saveBlockNote(challenge, index, note), 'Could not save that note.')
          }
          onCompleteBlock={(block) =>
            run(() => data.completeBlock(challenge, block), 'Could not log those deposits.')
          }
          onToggleWeek={(week) =>
            run(() => data.toggleChallengeWeek(challenge, week), 'Could not update that week.')
          }
        />
      )}
    </DialogScreen>
  );
}

function ChallengeBody({
  challenge,
  busy,
  designSchema,
  onMultiplier,
  onNote,
  onCompleteBlock,
  onToggleWeek,
}: {
  challenge: ChallengeView;
  busy: boolean;
  designSchema: boolean;
  onMultiplier: (multiplier: number) => void;
  onNote: (blockIndex: number, note: string) => void;
  onCompleteBlock: (block: ChallengeBlockDetail) => void;
  onToggleWeek: (week: number) => void;
}) {
  const theme = useTheme();
  const [notes, setNotes] = useState<Record<string, string>>(challenge.blockNotes);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const multiplierOptions = useMemo(() => {
    const values: number[] = [...CHALLENGE_MULTIPLIERS];
    if (!values.includes(challenge.multiplier)) values.push(challenge.multiplier);
    return values.map((value) => ({ value: String(value), label: `$${value} Multiplier` }));
  }, [challenge.multiplier]);

  const canChangeMultiplier = challenge.challengeType === 'classic_ascending' && designSchema;
  const percent = Math.round(challenge.percent);

  return (
    <View style={{ gap: Space[4] }}>
      <View style={{ alignItems: 'flex-end' }}>
        <SelectField
          label="Multiplier"
          hideLabel
          value={String(challenge.multiplier)}
          onChange={(value) => onMultiplier(Number(value))}
          options={multiplierOptions}
          disabled={!canChangeMultiplier || busy}
          width={220}
        />
      </View>
      {!designSchema ? (
        <ThemedText type="small" themeColor="textSecondary">
          Changing the multiplier and saving block notes arrive with the next app update.
        </ThemedText>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] }}>
        <Tile bg={theme.backgroundSelected} label="Total saved" labelColor={theme.solidAccent}>
          <ThemedText style={tileValue}>
            {formatMoney(challenge.savedCents)}
            <ThemedText themeColor="textSecondary" style={{ fontSize: 15 }}>
              {' '}
              / {formatMoney(challenge.targetCents)}
            </ThemedText>
          </ThemedText>
        </Tile>
        <Tile bg={theme.successMuted} label="Blocks done" labelColor={theme.success}>
          <ThemedText style={tileValue}>
            {challenge.blocksDone}/{challenge.blocks.length}
          </ThemedText>
        </Tile>
        <Tile bg={theme.primaryMuted} label="Progress" labelColor={theme.text}>
          <ThemedText style={tileValue}>{percent}%</ThemedText>
        </Tile>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Start {formatActivityDate(challenge.startDate)} · Est. end{' '}
        {formatShortDate(challenge.endDate)} · Currently Week {challenge.currentWeek} of{' '}
        {challenge.totalWeeks}
      </ThemedText>

      {challenge.blocks.map((block) => {
        const isOpen = !!expanded[block.index];
        return (
          <View
            key={block.index}
            style={{
              gap: Space[3],
              padding: Space[4],
              borderRadius: Radius.smallCard,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: Space[2],
              }}
            >
              <View>
                <ThemedText
                  accessibilityRole="header"
                  style={{ fontFamily: Fonts.heading.semibold, fontSize: 18, lineHeight: 24 }}
                >
                  {block.label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {STATUS_LABEL[block.status]}
                </ThemedText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <ThemedText style={{ fontFamily: Fonts.heading.semibold, fontSize: 18 }}>
                  {formatMoney(block.savedCents)}
                  <ThemedText themeColor="textSecondary" style={{ fontSize: 16 }}>
                    {' '}
                    / {formatMoney(block.targetCents)}
                  </ThemedText>
                </ThemedText>
                <ThemedText type="eyebrow" themeColor="textSecondary" style={{ fontSize: 11 }}>
                  Saved / target
                </ThemedText>
              </View>
            </View>

            <TextField
              label={`Notes for ${block.label}`}
              hideLabel
              placeholder="Notes"
              value={notes[String(block.index)] ?? ''}
              onChangeText={(text) =>
                setNotes((current) => ({ ...current, [String(block.index)]: text }))
              }
              onBlur={() => {
                const next = (notes[String(block.index)] ?? '').trim();
                if (next !== (challenge.blockNotes[String(block.index)] ?? '')) {
                  onNote(block.index, next);
                }
              }}
              editable={designSchema}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
              <Button
                label="Mark Deposits Complete"
                size="sm"
                shape="rounded"
                disabled={block.allDone || busy}
                onPress={() => onCompleteBlock(block)}
                accessibilityLabel={`Mark deposits complete for ${block.label}`}
              />
              <Button
                label={isOpen ? 'Hide weeks' : 'Expand weeks'}
                variant="outline"
                size="sm"
                shape="rounded"
                onPress={() => setExpanded((current) => ({ ...current, [block.index]: !isOpen }))}
                aria-expanded={isOpen}
                accessibilityLabel={`${isOpen ? 'Hide' : 'Expand'} weeks for ${block.label}`}
              />
            </View>

            {isOpen ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] }}>
                {block.weeks.map((week) => (
                  <Pressable
                    key={week.week}
                    accessibilityRole="button"
                    aria-pressed={week.done}
                    accessibilityLabel={`Week ${week.week}, ${formatMoney(week.done ? week.savedCents : week.targetCents)}, ${week.done ? 'done. Tap to undo' : 'not done. Tap to log'}`}
                    disabled={busy}
                    onPress={() => onToggleWeek(week.week)}
                    style={{
                      minWidth: 76,
                      minHeight: 52,
                      paddingVertical: Space[2],
                      paddingHorizontal: Space[3],
                      borderRadius: Radius.input,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: week.done ? theme.solidSuccess : theme.backgroundSelected,
                    }}
                  >
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: week.done ? theme.onSolid : theme.textSecondary,
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                    >
                      {week.done ? '✓ ' : ''}W{week.week}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color: week.done ? theme.onSolid : theme.textSecondary,
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                    >
                      {formatMoney(week.done ? week.savedCents : week.targetCents)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const tileValue = { fontFamily: Fonts.heading.bold, fontSize: 22, lineHeight: 28 } as const;

function Tile({
  bg,
  label,
  labelColor,
  children,
}: {
  bg: string;
  label: string;
  labelColor: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 150,
        gap: Space[2],
        padding: Space[4],
        borderRadius: Radius.smallCard,
        backgroundColor: bg,
      }}
    >
      <ThemedText type="eyebrow" style={{ color: labelColor, fontSize: 13 }}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}
