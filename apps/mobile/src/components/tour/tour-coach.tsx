import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import {
  TOUR_SECTIONS,
  formatCents,
  tourProgressLabel,
  unfinishedSections,
  type TourCountKey,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { BuddyMascot, type BuddyMood } from '@/components/tour/buddy-mascot';
import { Button } from '@/components/ui/button';
import { Layout, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTour } from '@/contexts/tour-context';
import { useTheme } from '@/hooks/use-theme';

/** Screens the tour can sit on top of. Anything else (a form, Settings…) hides it. */
const TOUR_SURFACES = new Set([
  '/',
  '/plan',
  '/bills',
  '/money',
  '/more',
  '/grocery-list',
  '/reports',
]);

type Phase = 'explain' | 'ask' | 'saved';

/**
 * Budget Buddy's coach panel for the guided tour. It docks beside the real
 * screen (never over the whole app), explains the current section, shows a
 * Key & Clue tip, then asks one question. "Add this now" opens the section's
 * existing form; when the user comes back, Buddy re-reads what's saved and
 * confirms it. Nothing is saved by the panel itself.
 */
export function TourCoach() {
  const { status } = useAuth();
  const tour = useTour();
  const pathname = usePathname();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= Layout.sidebarBreakpoint;

  const [phase, setPhase] = useState<Phase>('explain');
  const [minimized, setMinimized] = useState(false);
  const [noNewNote, setNoNewNote] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  // Set while one of the existing forms is open from the tour.
  const awaitingForm = useRef<{ index: number; key: TourCountKey; before: number } | null>(null);

  const { state, section, counts } = tour;
  const interview = section.interview;

  // A new section always starts with Buddy's explanation.
  const [phaseFor, setPhaseFor] = useState(state.current);
  if (phaseFor !== state.current) {
    setPhaseFor(state.current);
    setPhase('explain');
    setNoNewNote(false);
  }

  // Back from a form: re-read what's saved and confirm, or say nothing changed.
  useEffect(() => {
    const pending = awaitingForm.current;
    if (!pending || pathname !== section.route || pending.index !== state.current) return;
    awaitingForm.current = null;
    void tour.refreshCounts().then((fresh) => {
      if (fresh && fresh[pending.key] > pending.before) {
        tour.record('added');
        setPhase('saved');
      } else {
        setNoNewNote(true);
        setPhase('ask');
      }
    });
    // Re-run only when the visible screen changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape minimizes the panel on web (it never traps focus).
  useEffect(() => {
    if (Platform.OS !== 'web' || state.status !== 'active') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMinimized(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status]);

  if (status !== 'signedIn' || !tour.loaded) return null;

  const dock = {
    position: 'absolute' as const,
    zIndex: 50,
    ...(isWide
      ? { right: Space[7], bottom: 104, width: 400 }
      : { left: Space[3], right: Space[3], bottom: Platform.OS === 'web' ? 76 : 100 }),
  };
  const panelStyle = {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    shadowColor: '#001228',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  };

  // --- Finished: a short wrap-up with an easy path to anything skipped ---
  if (justFinished && state.status === 'completed' && pathname === '/') {
    const unfinished = unfinishedSections(state);
    return (
      <View style={[dock, panelStyle, { padding: Space[5], gap: Space[3] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[3] }}>
          <BuddyMascot mood="celebrating" size={64} />
          <ThemedText type="subtitle" style={{ flex: 1 }} accessibilityRole="header">
            That’s the tour!
          </ThemedText>
        </View>
        <ThemedText accessibilityLiveRegion="polite">
          You’ve seen every part of Own My Budget. Everything you saved is on its tab, and you can
          take the tour again anytime from Settings.
        </ThemedText>
        {unfinished.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Saved for later: {unfinished.map((s) => s.title).join(', ')}. The “Finish setting up
            your budget” card on your dashboard has quick links.
          </ThemedText>
        ) : null}
        <Button label="Done" variant="panel" onPress={() => setJustFinished(false)} />
      </View>
    );
  }

  // --- Paused ("Do this later"): a gentle offer on the Dashboard only ---
  if (state.status === 'paused') {
    if (pathname !== '/') return null;
    return (
      <View style={[dock, panelStyle, { padding: Space[4], gap: Space[3] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[3] }}>
          <BuddyMascot mood="idle" size={52} />
          <ThemedText style={{ flex: 1 }}>
            Budget Buddy can show you around whenever you’re ready.
            {state.current > 0 ? ` You stopped at ${section.title}.` : ''}
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', gap: Space[2], flexWrap: 'wrap' }}>
          <Button
            label={state.current > 0 ? 'Resume tour' : 'Start the tour'}
            variant="panel"
            size="sm"
            onPress={tour.resume}
          />
          <Button label="Not now" variant="quiet" size="sm" onPress={tour.dismiss} />
        </View>
      </View>
    );
  }

  if (state.status !== 'active') return null;
  // A form or another screen is open: step aside completely.
  if (!TOUR_SURFACES.has(pathname)) return null;

  const onSection = pathname === section.route;

  if (minimized || !onSection) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Continue the tour with Budget Buddy: ${section.title}, ${tourProgressLabel(state.current)}`}
        onPress={() => {
          setMinimized(false);
          if (!onSection) tour.showSection();
        }}
        style={[
          dock,
          panelStyle,
          isWide ? { width: undefined } : null,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Space[2],
            paddingVertical: Space[2],
            paddingHorizontal: Space[3],
            minHeight: 52,
            borderRadius: Radius.full,
          },
        ]}
      >
        <BuddyMascot mood="idle" size={36} />
        <ThemedText type="smallBold">
          Continue tour · {section.title} ({tourProgressLabel(state.current)})
        </ThemedText>
      </Pressable>
    );
  }

  const count = interview && counts ? counts[interview.countKey] : null;
  const noun = interview ? (count === 1 ? interview.noun[0] : interview.noun[1]) : '';
  const isLast = state.current === TOUR_SECTIONS.length - 1;
  const mood: BuddyMood =
    phase === 'saved' ? 'celebrating' : phase === 'ask' ? 'listening' : 'speaking';

  const finishSection = (result: 'kept' | 'later' | 'skipped' | 'viewed') => {
    tour.record(result);
    if (isLast) setJustFinished(true);
    tour.next();
  };
  const openForm = () => {
    if (!interview) return;
    awaitingForm.current = { index: state.current, key: interview.countKey, before: count ?? 0 };
    setNoNewNote(false);
    router.push(
      (interview.formParams
        ? { pathname: interview.formRoute, params: interview.formParams }
        : interview.formRoute) as Href
    );
  };
  const goToAsk = () => {
    setPhase('ask');
    void tour.refreshCounts();
  };

  const incomeLine =
    section.id === 'income' && counts && counts.incomeSources > 0
      ? `This month your pay schedules add up to ${formatCents(counts.monthIncomeCents)} of income. That’s money coming in, not a payment.`
      : null;

  return (
    <View
      aria-label="Budget Buddy guided tour"
      style={[dock, panelStyle, { maxHeight: isWide ? '56%' : '50%' }]}
    >
      <ScrollView contentContainerStyle={{ padding: Space[5], gap: Space[4] }}>
        {/* Progress, title and controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText type="small" themeColor="textSecondary">
              {tourProgressLabel(state.current)}
            </ThemedText>
            <ThemedText type="smallBold" style={{ fontSize: 17 }} accessibilityRole="header">
              {section.title}
            </ThemedText>
          </View>
          <Button
            label="Minimize"
            size="sm"
            variant="quiet"
            onPress={() => setMinimized(true)}
            accessibilityLabel="Minimize the tour panel"
          />
          <Button
            label="Pause"
            size="sm"
            variant="quiet"
            onPress={tour.pause}
            accessibilityLabel="Pause the tour. You can resume it from your dashboard."
          />
        </View>
        <View
          accessibilityElementsHidden
          style={{ height: 6, borderRadius: 3, backgroundColor: theme.backgroundSelected }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 3,
              width: `${((state.current + 1) / TOUR_SECTIONS.length) * 100}%`,
              backgroundColor: theme.primary,
            }}
          />
        </View>

        {/* Budget Buddy and what he's saying */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Space[3] }}>
          <BuddyMascot mood={mood} size={64} />
          <View
            style={{
              flex: 1,
              borderWidth: 1.5,
              borderColor: theme.border,
              backgroundColor: theme.background,
              borderRadius: Radius.smallCard,
              paddingVertical: Space[3],
              paddingHorizontal: Space[4],
              gap: Space[2],
            }}
          >
            <ThemedText accessibilityLiveRegion="polite">
              {phase === 'explain'
                ? section.explanation
                : phase === 'saved'
                  ? `Saved! You now have ${count ?? 'your new'} ${noun}. You’ll find ${
                      count === 1 ? 'it' : 'them'
                    } on this tab.`
                  : (interview?.question ?? '')}
            </ThemedText>
            {phase === 'explain' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Look for: {section.lookFor}
              </ThemedText>
            ) : null}
          </View>
        </View>

        {phase === 'explain' ? (
          <View
            style={{
              backgroundColor: theme.primaryMuted,
              borderRadius: Radius.input,
              padding: Space[4],
              gap: Space[1],
            }}
          >
            <ThemedText type="small" themeColor="primary" style={{ letterSpacing: 0.4 }}>
              KEY & CLUE
            </ThemedText>
            <ThemedText type="smallBold">{section.keyClue.term}</ThemedText>
            <ThemedText type="small">{section.keyClue.text}</ThemedText>
          </View>
        ) : null}

        {phase !== 'explain' && interview ? (
          <View style={{ gap: Space[2] }}>
            {counts === null && !tour.countsError ? (
              <ThemedText type="small" themeColor="textSecondary">
                Checking what you already have…
              </ThemedText>
            ) : null}
            {tour.countsError ? (
              <ThemedText type="small" themeColor="warning" accessibilityRole="alert">
                We couldn’t check what’s saved just now. You can still add something or move on.
              </ThemedText>
            ) : null}
            {phase === 'ask' && count !== null && count > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                You already have {count} {noun}. Your saved ones stay exactly as they are; edit them
                on this tab anytime.
              </ThemedText>
            ) : null}
            {noNewNote && phase === 'ask' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nothing new was saved, and that’s fine.
              </ThemedText>
            ) : null}
            {incomeLine ? (
              <ThemedText type="small" themeColor="textSecondary">
                {incomeLine}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {tour.storageError ? (
          <ThemedText type="small" themeColor="warning" accessibilityRole="alert">
            We couldn’t keep your tour progress on this device. You can keep going; it may restart
            next time.
          </ThemedText>
        ) : null}

        {/* Actions */}
        <View style={{ gap: Space[2] }}>
          {phase === 'explain' ? (
            <>
              <Button
                label={interview ? 'Continue' : isLast ? 'Finish tour' : 'Next section'}
                variant="panel"
                onPress={interview ? goToAsk : () => finishSection('viewed')}
              />
              {interview ? (
                <Button
                  label="Skip this section"
                  variant="quiet"
                  onPress={() => finishSection('skipped')}
                />
              ) : null}
            </>
          ) : null}

          {phase === 'ask' && interview ? (
            <>
              <Button
                label={count ? 'Add another' : `${interview.addLabel} now`}
                variant="panel"
                onPress={openForm}
              />
              {count ? (
                <Button
                  label="Keep what I have"
                  variant="outline"
                  onPress={() => finishSection('kept')}
                />
              ) : null}
              <Button
                label="I’ll add it later"
                variant="outline"
                onPress={() => finishSection('later')}
              />
              <Button
                label="Skip this section"
                variant="quiet"
                onPress={() => finishSection('skipped')}
              />
            </>
          ) : null}

          {phase === 'saved' && interview ? (
            <>
              <Button
                label={isLast ? 'Finish tour' : 'Next section'}
                variant="panel"
                onPress={() => {
                  if (isLast) setJustFinished(true);
                  tour.next();
                }}
              />
              <Button label="Add another" variant="outline" onPress={openForm} />
            </>
          ) : null}

          {phase === 'ask' || phase === 'saved' ? (
            <Button
              label="Back to Buddy’s explanation"
              variant="quiet"
              onPress={() => setPhase('explain')}
            />
          ) : state.current > 0 ? (
            <Button label="Previous section" variant="quiet" onPress={tour.back} />
          ) : null}
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          Budget Buddy explains the app and its terms. It’s educational, not financial advice.
        </ThemedText>
      </ScrollView>
    </View>
  );
}
