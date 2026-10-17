import {
  routeIntent,
  proposeBillPayment,
  sendBudgetBuddyMessage,
  getBuddyVoiceStatus,
  transcribeBuddyAudio,
  synthesizeBuddySpeech,
  EdgeFunctionError,
} from '../queries/edge-functions';
import type { TypedSupabaseClient } from '../client';

function mockClient(invokeResult: { data?: unknown; error?: unknown }): TypedSupabaseClient {
  return {
    functions: {
      invoke: jest.fn().mockResolvedValue(invokeResult),
    },
  } as unknown as TypedSupabaseClient;
}

describe('routeIntent', () => {
  it('calls the intent-router function with the given text', async () => {
    const client = mockClient({ data: { status: 'disabled' } });
    await routeIntent(client, 'I paid Georgia Power $75 yesterday.');
    expect(client.functions.invoke).toHaveBeenCalledWith('intent-router', {
      body: { text: 'I paid Georgia Power $75 yesterday.' },
    });
  });

  it('returns a recommendation result unchanged', async () => {
    const recommendation = {
      status: 'recommendation',
      requestId: 'req-1',
      intent: 'record_bill_payment',
      confidence: 0.91,
      band: 'high',
      action: 'preselect',
    };
    const client = mockClient({ data: recommendation });
    const result = await routeIntent(client, 'I paid Georgia Power $75 yesterday.');
    expect(result).toEqual(recommendation);
  });

  it('returns a disabled result when the voice-routing flag is off', async () => {
    const client = mockClient({ data: { status: 'disabled' } });
    const result = await routeIntent(client, 'anything');
    expect(result).toEqual({ status: 'disabled' });
  });

  it('returns a fallback result on any Jev failure, never throwing', async () => {
    const client = mockClient({ data: { status: 'fallback', reason: 'timeout' } });
    const result = await routeIntent(client, 'anything');
    expect(result).toEqual({ status: 'fallback', reason: 'timeout' });
  });

  it('throws EdgeFunctionError for a real error response (e.g. usage limit)', async () => {
    const client = mockClient({ data: { error: 'limit reached', code: 'usage_limit' } });
    await expect(routeIntent(client, 'anything')).rejects.toThrow(EdgeFunctionError);
  });
});

describe('proposeBillPayment', () => {
  it('calls the ai-orchestrate function with the given text', async () => {
    const client = mockClient({ data: { status: 'disabled' } });
    await proposeBillPayment(client, 'I paid Georgia Power $75 yesterday.');
    expect(client.functions.invoke).toHaveBeenCalledWith('ai-orchestrate', {
      body: { text: 'I paid Georgia Power $75 yesterday.' },
    });
  });

  it('returns a proposal result unchanged, including the confirmation token', async () => {
    const proposal = {
      status: 'proposal',
      requestId: 'req-1',
      needsConfirmation: true,
      proposal: { billId: 'bill-1', billMatch: 'exact', amountCents: 7500, paidOn: '2026-10-03' },
      confirmationToken: 'deadbeef.cafebabe',
      expiresAt: 1234567890,
    };
    const client = mockClient({ data: proposal });
    const result = await proposeBillPayment(client, 'anything');
    expect(result).toEqual(proposal);
  });

  it('returns needs_human_review unchanged — never throws when the loop cannot safely finish', async () => {
    const client = mockClient({
      data: { status: 'needs_human_review', reason: 'max_loops_reached' },
    });
    const result = await proposeBillPayment(client, 'anything');
    expect(result).toEqual({ status: 'needs_human_review', reason: 'max_loops_reached' });
  });

  it('returns a disabled result when the orchestrator flag is off', async () => {
    const client = mockClient({ data: { status: 'disabled' } });
    const result = await proposeBillPayment(client, 'anything');
    expect(result).toEqual({ status: 'disabled' });
  });

  it('throws EdgeFunctionError for a real error response (e.g. usage limit)', async () => {
    const client = mockClient({ data: { error: 'limit reached', code: 'usage_limit' } });
    await expect(proposeBillPayment(client, 'anything')).rejects.toThrow(EdgeFunctionError);
  });
});

describe('sendBudgetBuddyMessage', () => {
  it('sends a typed message exactly as before — no mode, no signal', async () => {
    const client = mockClient({ data: { reply: 'Hi there.' } });
    const reply = await sendBudgetBuddyMessage(client, 'Hello', []);
    expect(reply).toBe('Hi there.');
    expect(client.functions.invoke).toHaveBeenCalledWith('budget-buddy-chat', {
      body: { message: 'Hello', history: [] },
    });
  });

  it('marks a spoken message as voice mode and passes the cancel signal through', async () => {
    const client = mockClient({ data: { reply: 'Sure.' } });
    const { signal } = new AbortController();
    const history = [{ role: 'assistant' as const, content: 'Hi there.' }];
    await sendBudgetBuddyMessage(client, 'What is a budget?', history, { mode: 'voice', signal });
    expect(client.functions.invoke).toHaveBeenCalledWith('budget-buddy-chat', {
      body: { message: 'What is a budget?', history, mode: 'voice' },
      signal,
    });
  });
});

describe('Budget Buddy voice', () => {
  it('asks the voice function for status', async () => {
    const client = mockClient({ data: { enabled: false } });
    expect(await getBuddyVoiceStatus(client)).toEqual({ enabled: false });
    expect(client.functions.invoke).toHaveBeenCalledWith('budget-buddy-voice', {
      body: { action: 'status' },
    });
  });

  it('sends a recording for transcription with its request id and duration', async () => {
    const client = mockClient({ data: { transcript: 'What is a budget?', remaining: 19 } });
    const { signal } = new AbortController();
    const result = await transcribeBuddyAudio(
      client,
      { requestId: 'request-0001', audioBase64: 'GkXfow==', durationMs: 4200 },
      signal
    );
    expect(result).toEqual({ transcript: 'What is a budget?', remaining: 19 });
    expect(client.functions.invoke).toHaveBeenCalledWith('budget-buddy-voice', {
      body: {
        action: 'transcribe',
        requestId: 'request-0001',
        audioBase64: 'GkXfow==',
        durationMs: 4200,
      },
      signal,
    });
  });

  it('never sends a user id — the server identifies the caller from the session', async () => {
    const client = mockClient({ data: { transcript: 'Hi', remaining: 1 } });
    await transcribeBuddyAudio(client, {
      requestId: 'request-0001',
      audioBase64: 'GkXfow==',
      durationMs: 1000,
    });
    const [, options] = (client.functions.invoke as jest.Mock).mock.calls[0];
    expect(Object.keys(options.body).sort()).toEqual([
      'action',
      'audioBase64',
      'durationMs',
      'requestId',
    ]);
  });

  it('requests the spoken version of a reply', async () => {
    const speech = { audioBase64: '//sQ', mimeType: 'audio/mpeg', truncated: false, remaining: 39 };
    const client = mockClient({ data: speech });
    const result = await synthesizeBuddySpeech(client, { requestId: 'request-0002', text: 'Hi.' });
    expect(result).toEqual(speech);
    expect(client.functions.invoke).toHaveBeenCalledWith('budget-buddy-voice', {
      body: { action: 'speak', requestId: 'request-0002', text: 'Hi.' },
    });
  });

  it.each(['usage_limit', 'voice_not_in_plan', 'duplicate_request', 'provider_timeout'])(
    'surfaces the server’s message and "%s" code from a non-2xx response',
    async (code) => {
      const client = mockClient({
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { json: async () => ({ error: 'A friendly message.', code }) },
        },
      });
      const attempt = transcribeBuddyAudio(client, {
        requestId: 'request-0001',
        audioBase64: 'GkXfow==',
        durationMs: 1000,
      });
      await expect(attempt).rejects.toMatchObject({ message: 'A friendly message.', code });
      await expect(attempt).rejects.toBeInstanceOf(EdgeFunctionError);
    }
  );
});
