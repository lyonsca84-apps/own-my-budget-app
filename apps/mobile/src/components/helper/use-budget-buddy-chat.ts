import { useCallback, useRef, useState } from 'react';
import {
  EdgeFunctionError,
  getCurrentAccount,
  getFeatureUsageCount,
  sendBudgetBuddyMessage,
  type BudgetBuddyHistoryMessage,
  type BudgetBuddyMessageOptions,
} from '@own-my-budget/api';
import {
  evaluateFeatureGate,
  getUsagePeriodStart,
  FEATURE_REGISTRY,
  type FeatureGateResult,
  type PlanTier,
} from '@own-my-budget/core';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

export interface ChatMessage extends BudgetBuddyHistoryMessage {
  id: string;
}

export interface BudgetBuddyChat {
  isGuest: boolean;
  gate: FeatureGateResult | null;
  gateFailed: boolean;
  messages: ChatMessage[];
  draft: string;
  setDraft: (value: string) => void;
  isSending: boolean;
  errorMessage: string | null;
  /** Set when the server says the plan's allowance is used up. */
  limitReason: string | null;
  reloadGate: () => Promise<void>;
  /**
   * Sends `text` (or the current draft). Resolves once the reply — or an
   * error — is in, with the reply text, or null when nothing was sent or it
   * failed. Typed and spoken messages both come through here, so they share
   * one conversation; a spoken one passes `{ mode: 'voice' }`.
   */
  send: (text?: string, options?: BudgetBuddyMessageOptions) => Promise<string | null>;
  clear: () => void;
}

/**
 * State for a Budget Buddy conversation. History lives only here (the edge
 * function never stores chat), so "Clear chat" is a plain local reset.
 * The plan-allowance check is loaded on demand via `reloadGate` — call it
 * when the chat becomes visible — so mounting the hook costs nothing.
 */
export function useBudgetBuddyChat(initialDraft = ''): BudgetBuddyChat {
  const { status, user } = useAuth();
  const [gate, setGate] = useState<FeatureGateResult | null>(null);
  const [gateFailed, setGateFailed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [limitReason, setLimitReason] = useState<string | null>(null);
  const counter = useRef(0);
  /** Set synchronously, so two sends in the same tick can't both get past the `isSending` state. */
  const sendingRef = useRef(false);

  const reloadGate = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    try {
      const account = await getCurrentAccount(supabase, user.id);
      const plan = account.entitlement.plan_tier as PlanTier;
      const limit = FEATURE_REGISTRY.budgetBuddyAction.limits[plan];
      const periodStart = getUsagePeriodStart(
        limit.kind === 'count' ? (limit.period ?? 'lifetime') : 'lifetime'
      );
      const currentUsage = await getFeatureUsageCount(
        supabase,
        user.id,
        'budgetBuddyAction',
        periodStart
      );
      setGate(evaluateFeatureGate('budgetBuddyAction', { plan, currentUsage }));
      setGateFailed(false);
    } catch {
      setGateFailed(true);
    }
  }, [status, user]);

  const send = useCallback(
    async (text?: string, options?: BudgetBuddyMessageOptions) => {
      const content = (text ?? draft).trim();
      if (!content || !gate?.allowed || isSending || sendingRef.current) return null;
      sendingRef.current = true;
      const userMessage: ChatMessage = {
        id: `user-${counter.current++}`,
        role: 'user',
        content,
      };
      const history = messages.map(({ role, content: c }) => ({ role, content: c }));
      setMessages((prev) => [...prev, userMessage]);
      setDraft('');
      setErrorMessage(null);
      setLimitReason(null);
      setIsSending(true);
      try {
        const reply = await sendBudgetBuddyMessage(supabase, content, history, options);
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${counter.current++}`, role: 'assistant', content: reply },
        ]);
        await reloadGate();
        return reply;
      } catch (error) {
        if (options?.signal?.aborted) {
          // Cancelled on purpose (a voice turn's Cancel) — not an error, and
          // there's no typed draft to restore.
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
          return null;
        }
        if (error instanceof EdgeFunctionError && error.code === 'usage_limit') {
          setLimitReason(error.message);
        } else {
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : 'Budget Buddy couldn’t answer just now. Please try again.'
          );
        }
        // Put the words back so nothing the user typed is lost.
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        setDraft(content);
        return null;
      } finally {
        sendingRef.current = false;
        setIsSending(false);
      }
    },
    [draft, gate, isSending, messages, reloadGate]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setErrorMessage(null);
    setLimitReason(null);
  }, []);

  return {
    isGuest: status === 'guest',
    gate,
    gateFailed,
    messages,
    draft,
    setDraft,
    isSending,
    errorMessage,
    limitReason,
    reloadGate,
    send,
    clear,
  };
}
