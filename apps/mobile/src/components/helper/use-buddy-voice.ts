import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EdgeFunctionError,
  getBuddyVoiceStatus,
  synthesizeBuddySpeech,
  transcribeBuddyAudio,
  type BuddyVoiceStatus,
} from '@own-my-budget/api';

import { supabase } from '@/lib/supabase';

import type { BudgetBuddyChat } from './use-budget-buddy-chat';
import { createVoiceClip, isVoicePlaybackSupported } from './voice/voice-player';
import { isVoiceRecordingSupported, startVoiceRecording } from './voice/voice-recorder';
import {
  VoicePlaybackError,
  VoiceRecorderError,
  type VoiceClip,
  type VoiceRecorder,
} from './voice/voice-types';

export type BuddyVoicePhase = 'ready' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

export interface BuddyVoiceError {
  message: string;
  /** What "try again" should do, if trying again makes sense. */
  recovery: 'record' | 'speak' | null;
}

export interface BuddyVoice {
  /** False when voice is switched off, unsupported here, or the user isn't signed in — render nothing. */
  visible: boolean;
  /** True when a new recording can start right now. */
  canTalk: boolean;
  /** A calm "why voice isn't available" line (plan or allowance). Typed chat still works. */
  notice: string | null;
  phase: BuddyVoicePhase;
  elapsedSeconds: number;
  maxSeconds: number;
  error: BuddyVoiceError | null;
  /** The browser blocked autoplay — show a Play control; the audio is ready. */
  needsTapToPlay: boolean;
  /** A spoken reply is cached and can be replayed without a new request. */
  hasAudio: boolean;
  /** The latest reply has no audio yet, and one could be generated on request. */
  canListen: boolean;
  /** Whether the on/off switch for spoken replies applies to this plan at all. */
  canSpeak: boolean;
  spokenReplies: boolean;
  setSpokenReplies: (value: boolean) => void;
  start: () => void;
  done: () => void;
  cancel: () => void;
  stopAudio: () => void;
  /** Plays the cached reply again, or generates the latest reply's audio if there is none yet. */
  replay: () => void;
  /** Runs the current error's recovery action. */
  recover: () => void;
}

const FALLBACK_MAX_SECONDS = 60;
/** Server codes that mean "voice isn't available to you right now" rather than "that attempt failed". */
const ALLOWANCE_CODES = new Set([
  'usage_limit',
  'voice_not_in_plan',
  'voice_budget_reached',
  'voice_disabled',
]);

const RECORDER_MESSAGES: Record<VoiceRecorderError['code'], string> = {
  permission_denied:
    'Budget Buddy can’t use the microphone yet. Allow microphone access for this site in your browser, then try again — or type your question.',
  no_microphone: 'I couldn’t find a microphone. Plug one in and try again, or type your question.',
  unsupported: 'This browser can’t record audio here. You can type your question instead.',
  failed: 'The recording didn’t work. Please try again, or type your question.',
};

/** One id per tap. The server refuses a repeat, so a double-submit can never be charged twice. */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

/**
 * Turn-based tap-to-talk for a Budget Buddy conversation: record → transcribe
 * → the existing chat's `send` (so a spoken message lands in the same
 * conversation as a typed one) → speak the reply. One thing at a time —
 * starting a recording stops any audio, and a second tap while a turn is in
 * flight does nothing. Unmounting (closing the panel) releases the
 * microphone, cancels in-flight requests, and frees the cached audio.
 */
export function useBuddyVoice(chat: BudgetBuddyChat): BuddyVoice {
  const supported = useMemo(() => isVoiceRecordingSupported() && isVoicePlaybackSupported(), []);
  const [status, setStatus] = useState<BuddyVoiceStatus | null>(null);
  const [phase, setPhaseState] = useState<BuddyVoicePhase>('ready');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<BuddyVoiceError | null>(null);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [spokenReplies, setSpokenRepliesState] = useState(true);

  const phaseRef = useRef<BuddyVoicePhase>('ready');
  /** Bumped by cancel/stop/unmount so a late async result from an abandoned turn is ignored. */
  const runRef = useRef(0);
  const startingRef = useRef(false);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const clipRef = useRef<VoiceClip | null>(null);
  const clipTextRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spokenRepliesRef = useRef(true);
  const chatRef = useRef(chat);
  const lastReplyRef = useRef<string | null>(null);
  const speechAvailableRef = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  const enabled = status?.enabled === true;
  const signedInAndReady = !chat.isGuest && chat.gate !== null;
  const maxSeconds = status?.enabled ? status.maxRecordingSeconds : FALLBACK_MAX_SECONDS;
  const speechAvailable = status?.enabled === true && status.speech.remaining > 0;

  let lastReply: string | null = null;
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    if (chat.messages[i].role === 'assistant') {
      lastReply = chat.messages[i].content;
      break;
    }
  }

  useEffect(() => {
    chatRef.current = chat;
    lastReplyRef.current = lastReply;
    speechAvailableRef.current = speechAvailable;
  });

  const setPhase = useCallback((next: BuddyVoicePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const disposeClip = useCallback(() => {
    clipRef.current?.dispose();
    clipRef.current = null;
    clipTextRef.current = null;
    setHasAudio(false);
    setNeedsTapToPlay(false);
  }, []);

  // The cached audio belongs to one reply. Once the conversation moves on
  // (a new reply, or Clear chat) it is freed rather than replayed stale.
  useEffect(() => {
    if (clipRef.current && clipTextRef.current !== lastReply) disposeClip();
  }, [lastReply, disposeClip]);

  const teardown = useCallback(() => {
    runRef.current++;
    clearTimer();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    clipRef.current?.dispose();
    clipRef.current = null;
  }, [clearTimer]);

  useEffect(() => teardown, [teardown]);

  useEffect(() => {
    if (!supported || !signedInAndReady) return;
    const controller = new AbortController();
    getBuddyVoiceStatus(supabase, controller.signal).then(
      (next) => {
        if (!controller.signal.aborted) setStatus(next);
      },
      () => {
        // Voice simply stays hidden; typed chat is unaffected.
      }
    );
    return () => controller.abort();
  }, [supported, signedInAndReady]);

  const setRemaining = useCallback((kind: 'transcription' | 'speech', remaining: number) => {
    setStatus((prev) => (prev?.enabled ? { ...prev, [kind]: { ...prev[kind], remaining } } : prev));
  }, []);

  const reportFailure = useCallback(
    (failure: unknown, recovery: 'record' | 'speak') => {
      if (failure instanceof VoiceRecorderError) {
        setError({ message: RECORDER_MESSAGES[failure.code], recovery: 'record' });
        return;
      }
      // Only a coded server error carries wording written for customers.
      if (failure instanceof EdgeFunctionError && failure.code) {
        if (failure.code === 'duplicate_request') return;
        if (ALLOWANCE_CODES.has(failure.code)) {
          setServerNotice(failure.message);
          setRemaining(recovery === 'record' ? 'transcription' : 'speech', 0);
          return;
        }
        setError({
          message: failure.message,
          recovery: failure.code === 'rate_limited' ? null : recovery,
        });
        return;
      }
      setError({
        message:
          recovery === 'record'
            ? 'Budget Buddy couldn’t hear that just now. Check your connection and try again, or type your question.'
            : 'I couldn’t read that out loud just now. My reply is written above.',
        recovery,
      });
    },
    [setRemaining]
  );

  const playClip = useCallback(
    async (clip: VoiceClip) => {
      setNeedsTapToPlay(false);
      setPhase('speaking');
      try {
        await clip.play(() => {
          if (clipRef.current === clip && phaseRef.current === 'speaking') setPhase('ready');
        });
      } catch (failure) {
        if (clipRef.current !== clip) return;
        setPhase('ready');
        if (failure instanceof VoicePlaybackError && failure.code === 'blocked') {
          setNeedsTapToPlay(true);
        } else {
          setError({
            message: 'I couldn’t play that out loud. My reply is written above.',
            recovery: null,
          });
        }
      }
    },
    [setPhase]
  );

  const speakText = useCallback(
    async (text: string, run: number, controller: AbortController) => {
      disposeClip();
      setPhase('speaking');
      try {
        const result = await synthesizeBuddySpeech(
          supabase,
          { requestId: newRequestId(), text },
          controller.signal
        );
        if (run !== runRef.current) return;
        setRemaining('speech', result.remaining);
        const clip = createVoiceClip(result.audioBase64, result.mimeType);
        clipRef.current = clip;
        clipTextRef.current = text;
        setHasAudio(true);
        await playClip(clip);
      } catch (failure) {
        if (run !== runRef.current || controller.signal.aborted) return;
        setPhase('ready');
        reportFailure(failure, 'speak');
      }
    },
    [disposeClip, playClip, reportFailure, setPhase, setRemaining]
  );

  const finish = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || phaseRef.current !== 'listening') return;
    recorderRef.current = null;
    clearTimer();
    const run = runRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('transcribing');

    try {
      const recording = await recorder.stop();
      if (run !== runRef.current) return;

      const { transcript, remaining } = await transcribeBuddyAudio(
        supabase,
        {
          requestId: newRequestId(),
          audioBase64: recording.base64,
          durationMs: recording.durationMs,
        },
        controller.signal
      );
      if (run !== runRef.current) return;
      setRemaining('transcription', remaining);

      setPhase('thinking');
      const reply = await chatRef.current.send(transcript, {
        mode: 'voice',
        signal: controller.signal,
      });
      if (run !== runRef.current) return;

      // No reply means the chat already showed its own message and kept the
      // words in the composer — nothing more for voice to do.
      if (reply && spokenRepliesRef.current && speechAvailableRef.current) {
        await speakText(reply, run, controller);
      } else {
        setPhase('ready');
      }
    } catch (failure) {
      if (run !== runRef.current || controller.signal.aborted) return;
      setPhase('ready');
      reportFailure(failure, 'record');
    }
  }, [clearTimer, reportFailure, setPhase, setRemaining, speakText]);

  useEffect(() => {
    finishRef.current = () => void finish();
  }, [finish]);

  const canTalk =
    supported &&
    enabled &&
    status.transcription.remaining > 0 &&
    !!chat.gate?.allowed &&
    !chat.isSending &&
    (phase === 'ready' || phase === 'speaking');

  const stopAudio = useCallback(() => {
    if (phaseRef.current !== 'speaking') {
      clipRef.current?.stop();
      return;
    }
    runRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    clipRef.current?.stop();
    setPhase('ready');
  }, [setPhase]);

  const start = useCallback(async () => {
    if (!canTalk || startingRef.current) return;
    startingRef.current = true;
    stopAudio();
    setError(null);
    setNeedsTapToPlay(false);
    const run = ++runRef.current;
    try {
      const recorder = await startVoiceRecording();
      if (run !== runRef.current) {
        recorder.cancel();
        return;
      }
      recorderRef.current = recorder;
      setElapsedSeconds(0);
      setPhase('listening');
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setElapsedSeconds(Math.min(seconds, maxSeconds));
        if (seconds >= maxSeconds) finishRef.current();
      }, 250);
    } catch (failure) {
      if (run === runRef.current) reportFailure(failure, 'record');
    } finally {
      startingRef.current = false;
    }
  }, [canTalk, maxSeconds, reportFailure, setPhase, stopAudio]);

  const cancel = useCallback(() => {
    runRef.current++;
    clearTimer();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setElapsedSeconds(0);
    setPhase('ready');
  }, [clearTimer, setPhase]);

  const replay = useCallback(() => {
    if (phaseRef.current !== 'ready' && phaseRef.current !== 'speaking') return;
    setError(null);
    const clip = clipRef.current;
    if (clip) {
      clip.stop();
      void playClip(clip);
      return;
    }
    const text = lastReplyRef.current;
    if (!text || !speechAvailableRef.current) return;
    const run = ++runRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    void speakText(text, run, controller);
  }, [playClip, speakText]);

  const recover = useCallback(() => {
    const recovery = error?.recovery;
    setError(null);
    if (recovery === 'record') void start();
    else if (recovery === 'speak') replay();
  }, [error, replay, start]);

  const setSpokenReplies = useCallback(
    (value: boolean) => {
      spokenRepliesRef.current = value;
      setSpokenRepliesState(value);
      if (!value) stopAudio();
    },
    [stopAudio]
  );

  let notice: string | null = null;
  if (enabled) {
    if (status.transcription.limit <= 0) {
      notice =
        'Talking with Budget Buddy is part of the paid plans. You can still type your question.';
    } else if (status.transcription.remaining <= 0) {
      notice =
        serverNotice ??
        'You’ve used this month’s voice allowance. It resets next month — you can still type your question.';
    } else {
      notice = serverNotice;
    }
  }

  return {
    visible: supported && enabled && signedInAndReady,
    canTalk,
    notice,
    phase,
    elapsedSeconds,
    maxSeconds,
    error,
    needsTapToPlay,
    hasAudio,
    canListen: phase === 'ready' && !hasAudio && !!lastReply && speechAvailable,
    canSpeak: enabled && status.speech.limit > 0,
    spokenReplies,
    setSpokenReplies,
    start: () => void start(),
    done: () => void finish(),
    cancel,
    stopAudio,
    replay,
    recover,
  };
}
