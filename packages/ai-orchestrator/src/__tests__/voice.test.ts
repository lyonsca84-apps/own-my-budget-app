import {
  bytesToBase64,
  base64ToBytes,
  detectAudioFormat,
  handleVoiceRequest,
  pcmSampleRate,
  prepareSpeechText,
  readVoiceConfig,
  VoiceAuthError,
  VoiceProviderError,
  wrapPcmAsWav,
  type VoiceDeps,
  type VoiceFinalizeArgs,
  type VoicePlanTier,
  type VoiceReserveArgs,
  type VoiceReserveResult,
  type VoiceSpeech,
  type VoiceTranscription,
} from '../voice';

const MAGIC = {
  webm: [0x1a, 0x45, 0xdf, 0xa3],
  ogg: [0x4f, 0x67, 0x67, 0x53],
  mp3: [0x49, 0x44, 0x33],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

function fileStartingWith(magic: number[], size = 400): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(magic);
  return bytes;
}

const WEBM_BASE64 = bytesToBase64(fileStartingWith(MAGIC.webm));
const TRANSCRIPT = 'How do I start a budget for my first paycheck?';
const REPLY =
  'A budget is just a plan for your money. What is one bill you want to plan for first?';

interface LedgerRow {
  id: string;
  userId: string;
  kind: string;
  requestId: string;
  status: 'reserved' | VoiceFinalizeArgs['status'];
  costMicroUsd: number;
  costSource: 'reported' | 'estimated';
}

interface HarnessOptions {
  env?: Record<string, string>;
  /** null = no valid session. */
  userId?: string | null;
  plan?: VoicePlanTier;
  transcribe?: () => Promise<VoiceTranscription>;
  synthesize?: () => Promise<VoiceSpeech>;
}

/**
 * Real handler, fake edges. `reserve` mirrors the order of checks in the
 * reserve_voice_usage SQL function (duplicate → allowance → rate → budget →
 * insert) against an in-memory ledger; every row counts as "in the last
 * minute" and "this month".
 */
function harness(options: HarnessOptions = {}) {
  const env: Record<string, string> = {
    BUDDY_VOICE_ENABLED: 'true',
    BUDDY_VOICE_RATE_LIMIT_PER_MINUTE: '60',
    ...options.env,
  };
  const userId = options.userId === undefined ? 'user-a' : options.userId;
  const ledger: LedgerRow[] = [];
  const logs: unknown[] = [];

  const transcribe = jest.fn<Promise<VoiceTranscription>, Parameters<VoiceDeps['transcribe']>>(
    options.transcribe ?? (async () => ({ text: TRANSCRIPT, costUsd: 0.0002 }))
  );
  const synthesize = jest.fn<Promise<VoiceSpeech>, Parameters<VoiceDeps['synthesize']>>(
    options.synthesize ??
      (async () => ({ bytes: new Uint8Array([0xff, 0xfb, 1, 2, 3]), contentType: 'audio/mpeg' }))
  );
  const getPlanTier = jest.fn(async () => options.plan ?? 'guided');

  const reserve = jest.fn(async (args: VoiceReserveArgs): Promise<VoiceReserveResult> => {
    const mine = ledger.filter((row) => row.userId === args.userId && row.kind === args.kind);
    if (mine.some((row) => row.requestId === args.requestId)) return { outcome: 'duplicate' };
    const used = mine.filter((row) => row.status !== 'failed').length;
    if (used >= args.monthlyLimit) return { outcome: 'limit', usedCount: used };
    if (mine.length >= args.rateLimitPerMinute) return { outcome: 'rate_limited' };
    const spend = ledger
      .filter((row) => row.status !== 'failed')
      .reduce((sum, row) => sum + row.costMicroUsd, 0);
    if (spend + args.estimatedCostMicroUsd > args.monthlyBudgetMicroUsd) {
      return { outcome: 'budget' };
    }
    const row: LedgerRow = {
      id: `ledger-${ledger.length + 1}`,
      userId: args.userId,
      kind: args.kind,
      requestId: args.requestId,
      status: 'reserved',
      costMicroUsd: args.estimatedCostMicroUsd,
      costSource: 'estimated',
    };
    ledger.push(row);
    return { outcome: 'reserved', ledgerId: row.id, usedCount: used + 1 };
  });

  const finalize = jest.fn(async (ledgerId: string, outcome: VoiceFinalizeArgs) => {
    const row = ledger.find((candidate) => candidate.id === ledgerId);
    if (!row || row.status !== 'reserved') return;
    row.status = outcome.status;
    row.costMicroUsd = outcome.costMicroUsd;
    row.costSource = outcome.costSource;
  });

  const deps: VoiceDeps = {
    config: readVoiceConfig((name) => env[name]),
    authenticate: async () => {
      if (!userId) throw new VoiceAuthError('Invalid or expired session.');
      return userId;
    },
    getPlanTier,
    getMonthlyUsage: async (id) => ({
      transcription: ledger.filter(
        (row) => row.userId === id && row.kind === 'transcription' && row.status !== 'failed'
      ).length,
      speech: ledger.filter(
        (row) => row.userId === id && row.kind === 'speech' && row.status !== 'failed'
      ).length,
    }),
    reserve,
    finalize,
    transcribe,
    synthesize,
    log: (event, fields) => logs.push({ event, ...fields }),
  };

  return { deps, ledger, logs, transcribe, synthesize, getPlanTier, reserve, finalize };
}

function transcribeBody(requestId = 'request-0001', extra: Record<string, unknown> = {}) {
  return { action: 'transcribe', requestId, audioBase64: WEBM_BASE64, durationMs: 4000, ...extra };
}

function speakBody(requestId = 'request-0001', text = REPLY) {
  return { action: 'speak', requestId, text };
}

describe('authentication', () => {
  it.each([{ action: 'status' }, transcribeBody(), speakBody()])(
    'rejects $action without a valid session, before anything else runs',
    async (body) => {
      const h = harness({ userId: null });
      const result = await handleVoiceRequest(h.deps, body);
      expect(result.status).toBe(401);
      expect(result.body.code).toBe('unauthorized');
      expect(h.getPlanTier).not.toHaveBeenCalled();
      expect(h.reserve).not.toHaveBeenCalled();
      expect(h.transcribe).not.toHaveBeenCalled();
      expect(h.synthesize).not.toHaveBeenCalled();
    }
  );

  it('checks the session even when voice is switched off', async () => {
    const h = harness({ userId: null, env: { BUDDY_VOICE_ENABLED: 'false' } });
    const result = await handleVoiceRequest(h.deps, { action: 'status' });
    expect(result.status).toBe(401);
  });
});

describe('authorization', () => {
  it('always acts as the signed-in user, ignoring any user id in the request body', async () => {
    const h = harness({ userId: 'user-a' });
    const result = await handleVoiceRequest(
      h.deps,
      transcribeBody('request-0001', { userId: 'user-b', user_id: 'user-b' })
    );
    expect(result.status).toBe(200);
    expect(h.getPlanTier).toHaveBeenCalledWith('user-a');
    expect(h.reserve.mock.calls[0][0].userId).toBe('user-a');
    expect(h.ledger.every((row) => row.userId === 'user-a')).toBe(true);
  });

  it("keeps each user's allowance separate", async () => {
    const env = { BUDDY_VOICE_MONTHLY_TURNS_GUIDED: '1' };
    const a = harness({ userId: 'user-a', env });
    await handleVoiceRequest(a.deps, transcribeBody('request-0001'));

    // user-b shares user-a's ledger: user-a being at the limit must not block them.
    const b = harness({ userId: 'user-b', env });
    b.ledger.push(...a.ledger);
    const result = await handleVoiceRequest(b.deps, transcribeBody('request-0001'));
    expect(result.status).toBe(200);
  });
});

describe('kill switch', () => {
  it('is off unless BUDDY_VOICE_ENABLED is exactly "true"', () => {
    expect(readVoiceConfig(() => undefined).enabled).toBe(false);
    expect(readVoiceConfig(() => '1').enabled).toBe(false);
    expect(readVoiceConfig(() => ' TRUE ').enabled).toBe(true);
  });

  it('reports disabled on status and refuses paid actions without touching a provider', async () => {
    const h = harness({ env: { BUDDY_VOICE_ENABLED: 'false' } });
    expect((await handleVoiceRequest(h.deps, { action: 'status' })).body).toEqual({
      enabled: false,
    });
    for (const body of [transcribeBody(), speakBody()]) {
      const result = await handleVoiceRequest(h.deps, body);
      expect(result.status).toBe(403);
      expect(result.body.code).toBe('voice_disabled');
    }
    expect(h.reserve).not.toHaveBeenCalled();
    expect(h.transcribe).not.toHaveBeenCalled();
    expect(h.synthesize).not.toHaveBeenCalled();
  });
});

describe('plan entitlement', () => {
  it('does not include voice on the free plan by default', async () => {
    const h = harness({ plan: 'free' });
    for (const body of [transcribeBody(), speakBody()]) {
      const result = await handleVoiceRequest(h.deps, body);
      expect(result.status).toBe(403);
      expect(result.body.code).toBe('voice_not_in_plan');
    }
    expect(h.reserve).not.toHaveBeenCalled();
    expect(h.transcribe).not.toHaveBeenCalled();
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it.each<[VoicePlanTier, number, number]>([
    ['free', 0, 0],
    ['guided', 20, 40],
    ['budgetBuddy', 100, 200],
  ])('reports the %s allowance on status', async (plan, turns, spokenReplies) => {
    const h = harness({ plan });
    const result = await handleVoiceRequest(h.deps, { action: 'status' });
    expect(result.body).toMatchObject({
      enabled: true,
      maxRecordingSeconds: 60,
      transcription: { limit: turns, used: 0, remaining: turns },
      speech: { limit: spokenReplies, used: 0, remaining: spokenReplies },
    });
  });

  it('never advertises an unlimited allowance', () => {
    const { monthlyLimits } = readVoiceConfig(() => undefined);
    for (const limits of Object.values(monthlyLimits)) {
      for (const limit of Object.values(limits)) expect(Number.isFinite(limit)).toBe(true);
    }
  });
});

describe('usage enforcement', () => {
  it('stops at the monthly allowance with a friendly message, and typing is still offered', async () => {
    const h = harness({ env: { BUDDY_VOICE_MONTHLY_TURNS_GUIDED: '2' } });
    expect((await handleVoiceRequest(h.deps, transcribeBody('request-0001'))).status).toBe(200);
    expect((await handleVoiceRequest(h.deps, transcribeBody('request-0002'))).status).toBe(200);

    const third = await handleVoiceRequest(h.deps, transcribeBody('request-0003'));
    expect(third.status).toBe(403);
    expect(third.body.code).toBe('usage_limit');
    expect(third.body.error).toMatch(/still type/);
    expect(h.transcribe).toHaveBeenCalledTimes(2);
  });

  it('lets only one of two simultaneous requests through when one use is left', async () => {
    const h = harness({ env: { BUDDY_VOICE_MONTHLY_TURNS_GUIDED: '1' } });
    const results = await Promise.all([
      handleVoiceRequest(h.deps, transcribeBody('request-0001')),
      handleVoiceRequest(h.deps, transcribeBody('request-0002')),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 403]);
    expect(h.transcribe).toHaveBeenCalledTimes(1);
  });

  it('counts transcriptions and spoken replies separately', async () => {
    const h = harness({
      env: {
        BUDDY_VOICE_MONTHLY_TURNS_GUIDED: '1',
        BUDDY_VOICE_MONTHLY_SPOKEN_REPLIES_GUIDED: '1',
      },
    });
    expect((await handleVoiceRequest(h.deps, transcribeBody('request-0001'))).status).toBe(200);
    expect((await handleVoiceRequest(h.deps, speakBody('request-0001'))).status).toBe(200);
    expect((await handleVoiceRequest(h.deps, speakBody('request-0002'))).body.code).toBe(
      'usage_limit'
    );
    expect(h.ledger.map((row) => row.kind)).toEqual(['transcription', 'speech']);
  });

  it('reports what is left after each use', async () => {
    const h = harness({ env: { BUDDY_VOICE_MONTHLY_TURNS_GUIDED: '3' } });
    const first = await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    expect(first.body.remaining).toBe(2);
    const status = await handleVoiceRequest(h.deps, { action: 'status' });
    expect(status.body.transcription).toEqual({ limit: 3, used: 1, remaining: 2 });
  });

  it('rate-limits a burst', async () => {
    const h = harness({ env: { BUDDY_VOICE_RATE_LIMIT_PER_MINUTE: '2' } });
    await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    await handleVoiceRequest(h.deps, transcribeBody('request-0002'));
    const third = await handleVoiceRequest(h.deps, transcribeBody('request-0003'));
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('rate_limited');
    expect(h.transcribe).toHaveBeenCalledTimes(2);
  });

  it('stops calling the provider once the monthly spending cap is reached', async () => {
    // 600 characters at the default estimate is far more than a $0.000001 budget.
    const h = harness({ env: { BUDDY_VOICE_MONTHLY_BUDGET_USD: '0.000001' } });
    const result = await handleVoiceRequest(h.deps, speakBody());
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('voice_budget_reached');
    expect(result.body.error).toMatch(/still type/);
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it('gives the allowance back when the provider fails, and never retries on its own', async () => {
    let calls = 0;
    const h = harness({
      env: { BUDDY_VOICE_MONTHLY_TURNS_GUIDED: '1' },
      transcribe: async () => {
        calls++;
        if (calls === 1) throw new VoiceProviderError('http_error', 502);
        return { text: TRANSCRIPT };
      },
    });
    const failed = await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    expect(failed.status).toBe(502);
    expect(failed.body.code).toBe('provider_unavailable');
    expect(calls).toBe(1);
    expect(h.ledger[0].status).toBe('failed');
    expect(h.ledger[0].costMicroUsd).toBe(0);

    // The one use is still there for an explicit second try.
    const retry = await handleVoiceRequest(h.deps, transcribeBody('request-0002'));
    expect(retry.status).toBe(200);
  });

  it('keeps a cancelled call counted, since the provider may have charged for it', async () => {
    const h = harness({
      env: { BUDDY_VOICE_MONTHLY_TURNS_GUIDED: '1' },
      transcribe: async () => {
        throw new VoiceProviderError('cancelled');
      },
    });
    const cancelled = await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    expect(cancelled.body.code).toBe('cancelled');
    expect(h.ledger[0].status).toBe('cancelled');
    expect((await handleVoiceRequest(h.deps, transcribeBody('request-0002'))).body.code).toBe(
      'usage_limit'
    );
  });

  it('tells the customer when the provider could not read their recording', async () => {
    const h = harness({
      transcribe: async () => {
        throw new VoiceProviderError('rejected', 400);
      },
    });
    const result = await handleVoiceRequest(h.deps, transcribeBody());
    expect(result.status).toBe(422);
    expect(result.body.code).toBe('unreadable_recording');
    expect(h.ledger[0].status).toBe('failed');
  });

  it('maps a provider timeout to a retryable message', async () => {
    const h = harness({
      synthesize: async () => {
        throw new VoiceProviderError('timeout');
      },
    });
    const result = await handleVoiceRequest(h.deps, speakBody());
    expect(result.status).toBe(504);
    expect(result.body.code).toBe('provider_timeout');
    expect(h.ledger[0].status).toBe('failed');
  });

  it('fails closed when the ledger itself is unavailable', async () => {
    const h = harness();
    h.reserve.mockRejectedValueOnce(new Error('database unavailable'));
    const result = await handleVoiceRequest(h.deps, transcribeBody());
    expect(result.status).toBe(500);
    expect(result.body.code).toBe('server_error');
    expect(h.transcribe).not.toHaveBeenCalled();
  });

  it('records a reported provider cost as reported, and anything else as an estimate', async () => {
    const h = harness();
    await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    await handleVoiceRequest(h.deps, speakBody('request-0001'));
    const [transcription, speech] = h.ledger;
    expect(transcription).toMatchObject({ costSource: 'reported', costMicroUsd: 200 });
    // The speech endpoint returns audio only — no cost — so this is characters × the configured rate.
    expect(speech).toMatchObject({
      costSource: 'estimated',
      costMicroUsd: Math.ceil(REPLY.length * 0.000015 * 1_000_000),
    });
  });
});

describe('duplicate submissions', () => {
  it('refuses a repeated request id instead of paying for the same recording twice', async () => {
    const h = harness();
    const first = await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    const repeat = await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    expect(first.status).toBe(200);
    expect(repeat.status).toBe(409);
    expect(repeat.body.code).toBe('duplicate_request');
    expect(h.transcribe).toHaveBeenCalledTimes(1);
    expect(h.ledger).toHaveLength(1);
  });

  it('refuses a double-tap sent at the same moment', async () => {
    const h = harness();
    const results = await Promise.all([
      handleVoiceRequest(h.deps, speakBody('request-0001')),
      handleVoiceRequest(h.deps, speakBody('request-0001')),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(h.synthesize).toHaveBeenCalledTimes(1);
  });
});

describe('malformed uploads', () => {
  const cases: [string, unknown, number, string][] = [
    ['a body that is not an object', 'transcribe', 400, 'invalid_request'],
    ['an unknown action', { action: 'delete-everything' }, 400, 'invalid_request'],
    ['a missing request id', { ...transcribeBody(), requestId: undefined }, 400, 'invalid_request'],
    ['an unsafe request id', transcribeBody("x'; drop table--"), 400, 'invalid_request'],
    ['missing audio', { ...transcribeBody(), audioBase64: '' }, 400, 'invalid_request'],
    [
      'audio that is not base64',
      transcribeBody('request-0001', { audioBase64: '<<<not base64>>>' }),
      400,
      'invalid_request',
    ],
    [
      'a data: URI instead of raw base64',
      transcribeBody('request-0001', { audioBase64: `data:audio/webm;base64,${WEBM_BASE64}` }),
      400,
      'invalid_request',
    ],
    [
      'a non-numeric duration',
      transcribeBody('request-0001', { durationMs: '4000' }),
      400,
      'invalid_request',
    ],
    [
      'a recording over 60 seconds',
      transcribeBody('request-0001', { durationMs: 75_000 }),
      400,
      'recording_too_long',
    ],
    [
      'a recording too short to hear',
      transcribeBody('request-0001', { durationMs: 80 }),
      400,
      'recording_too_short',
    ],
    [
      'an empty-looking file',
      transcribeBody('request-0001', {
        audioBase64: bytesToBase64(fileStartingWith(MAGIC.webm, 40)),
      }),
      400,
      'recording_too_short',
    ],
    [
      'an image renamed as audio',
      transcribeBody('request-0001', {
        audioBase64: bytesToBase64(fileStartingWith(MAGIC.png)),
        mimeType: 'audio/webm',
      }),
      415,
      'unsupported_audio',
    ],
    [
      'plain text sent as audio',
      transcribeBody('request-0001', {
        audioBase64: bytesToBase64(new TextEncoder().encode('hello '.repeat(80))),
      }),
      415,
      'unsupported_audio',
    ],
  ];

  it.each(cases)('rejects %s', async (_name, body, status, code) => {
    const h = harness();
    const result = await handleVoiceRequest(h.deps, body);
    expect(result.status).toBe(status);
    expect(result.body.code).toBe(code);
    // Nothing is reserved or sent to a provider for a bad upload.
    expect(h.reserve).not.toHaveBeenCalled();
    expect(h.transcribe).not.toHaveBeenCalled();
  });

  it('rejects an oversized recording from its encoded length, without decoding it', async () => {
    const h = harness({ env: { BUDDY_VOICE_MAX_AUDIO_BYTES: '50000' } });
    const result = await handleVoiceRequest(
      h.deps,
      transcribeBody('request-0001', { audioBase64: 'A'.repeat(80_000) })
    );
    expect(result.status).toBe(413);
    expect(result.body.code).toBe('recording_too_large');
    expect(h.reserve).not.toHaveBeenCalled();
  });

  it.each([
    ['empty text', speakBody('request-0001', '   ')],
    ['text that is only formatting marks', speakBody('request-0001', '** __ ##')],
    ['text that is not a string', { action: 'speak', requestId: 'request-0001', text: 42 }],
    ['absurdly long text', speakBody('request-0001', 'a'.repeat(4001))],
  ])('rejects a speech request with %s', async (_name, body) => {
    const h = harness();
    const result = await handleVoiceRequest(h.deps, body);
    expect(result.status).toBe(400);
    expect(h.reserve).not.toHaveBeenCalled();
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it('identifies each supported recording format from its bytes', () => {
    expect(detectAudioFormat(fileStartingWith(MAGIC.webm))).toBe('webm');
    expect(detectAudioFormat(fileStartingWith(MAGIC.ogg))).toBe('ogg');
    expect(detectAudioFormat(fileStartingWith(MAGIC.mp3))).toBe('mp3');
    expect(detectAudioFormat(fileStartingWith([0xff, 0xfb]))).toBe('mp3');
    expect(detectAudioFormat(fileStartingWith([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70]))).toBe(
      'm4a'
    );
    const wav = fileStartingWith([0x52, 0x49, 0x46, 0x46]);
    wav.set([0x57, 0x41, 0x56, 0x45], 8);
    expect(detectAudioFormat(wav)).toBe('wav');
    expect(detectAudioFormat(fileStartingWith(MAGIC.png))).toBeNull();
    expect(detectAudioFormat(new Uint8Array(4))).toBeNull();
  });
});

describe('transcription', () => {
  it('sends the sniffed format and configured model, and returns the transcript', async () => {
    const h = harness();
    const result = await handleVoiceRequest(h.deps, transcribeBody());
    expect(result).toEqual({ status: 200, body: { transcript: TRANSCRIPT, remaining: 19 } });
    expect(h.transcribe).toHaveBeenCalledWith({
      base64: WEBM_BASE64,
      format: 'webm',
      model: 'openai/gpt-4o-mini-transcribe',
      timeoutMs: 30_000,
    });
  });

  it('says so, kindly, when there were no words in the recording', async () => {
    const h = harness({ transcribe: async () => ({ text: '   ' }) });
    const result = await handleVoiceRequest(h.deps, transcribeBody());
    expect(result.status).toBe(422);
    expect(result.body.code).toBe('no_speech');
  });
});

describe('speech', () => {
  it('returns playable audio for the configured model and voice', async () => {
    const h = harness();
    const result = await handleVoiceRequest(h.deps, speakBody());
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ mimeType: 'audio/mpeg', truncated: false, remaining: 39 });
    expect(Array.from(base64ToBytes(result.body.audioBase64 as string))).toEqual([
      0xff, 0xfb, 1, 2, 3,
    ]);
    expect(h.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        text: REPLY,
        model: 'microsoft/mai-voice-2.1-flash',
        voice: 'en-US-Harper:MAI-Voice-2.1-Flash',
        format: 'mp3',
      })
    );
  });

  it('wraps raw PCM in a WAV header at the rate the provider reported', async () => {
    const h = harness({
      env: { BUDDY_VOICE_TTS_FORMAT: 'pcm' },
      synthesize: async () => ({
        bytes: new Uint8Array([1, 2, 3, 4]),
        contentType: 'audio/pcm;rate=16000;channels=1',
      }),
    });
    const result = await handleVoiceRequest(h.deps, speakBody());
    expect(result.body.mimeType).toBe('audio/wav');
    const wav = base64ToBytes(result.body.audioBase64 as string);
    expect(detectAudioFormat(new Uint8Array([...wav, ...new Uint8Array(8)]))).toBe('wav');
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(16000);
    expect(Array.from(wav.slice(44))).toEqual([1, 2, 3, 4]);
  });

  it('keeps a long reply within the spoken length limit, ending on a whole sentence', async () => {
    const h = harness({ env: { BUDDY_VOICE_MAX_REPLY_CHARS: '120' } });
    const long = 'Start with what comes in each month. Then list the bills you must pay. '.repeat(
      6
    );
    const result = await handleVoiceRequest(h.deps, speakBody('request-0001', long));
    expect(result.body.truncated).toBe(true);
    const spoken = h.synthesize.mock.calls[0][0].text;
    expect(spoken.length).toBeLessThanOrEqual(120);
    expect(spoken.endsWith('.')).toBe(true);
  });

  it('treats an empty audio response as a provider failure and refunds it', async () => {
    const h = harness({
      synthesize: async () => ({ bytes: new Uint8Array(0), contentType: 'audio/mpeg' }),
    });
    const result = await handleVoiceRequest(h.deps, speakBody());
    expect(result.status).toBe(502);
    expect(h.ledger[0].status).toBe('failed');
  });

  it('strips markdown a voice would stumble over', () => {
    expect(
      prepareSpeechText('**Good news!**\n\n- Pay `rent` first\n- Then [save](https://x.test)', 600)
    ).toEqual({ text: 'Good news! Pay rent first Then save', truncated: false });
  });

  it('reads the PCM sample rate, defaulting to 24 kHz', () => {
    expect(pcmSampleRate('audio/pcm;rate=24000;channels=1')).toBe(24000);
    expect(pcmSampleRate('audio/pcm')).toBe(24000);
    expect(wrapPcmAsWav(new Uint8Array(10), 24000)).toHaveLength(54);
  });
});

describe('privacy', () => {
  it('never logs a transcript, a reply, or audio', async () => {
    const h = harness();
    await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    await handleVoiceRequest(h.deps, speakBody('request-0001'));
    await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    const logged = JSON.stringify(h.logs);
    expect(h.logs.length).toBeGreaterThan(0);
    expect(logged).not.toContain(TRANSCRIPT);
    expect(logged).not.toContain(REPLY);
    expect(logged).not.toContain(WEBM_BASE64.slice(0, 24));
  });

  it('never puts provider detail or an internal error in the customer message', async () => {
    const h = harness({
      transcribe: async () => {
        throw new Error('OPENROUTER_API_KEY=sk-or-secret rejected by upstream');
      },
    });
    const result = await handleVoiceRequest(h.deps, transcribeBody());
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toMatch(/sk-or|OPENROUTER|upstream/);
    expect(JSON.stringify(h.logs)).not.toMatch(/sk-or/);
  });
});

describe('configuration', () => {
  it('clamps values so a typo cannot remove a limit', () => {
    const config = readVoiceConfig(
      (name) =>
        ({
          BUDDY_VOICE_MAX_RECORDING_SECONDS: '600',
          BUDDY_VOICE_RATE_LIMIT_PER_MINUTE: '0',
          BUDDY_VOICE_MAX_REPLY_CHARS: 'lots',
          BUDDY_VOICE_STT_TIMEOUT_MS: '999999',
        })[name]
    );
    expect(config.maxRecordingSeconds).toBe(60);
    expect(config.rateLimitPerMinute).toBe(1);
    expect(config.maxSpeechChars).toBe(600);
    expect(config.sttTimeoutMs).toBe(60_000);
  });

  it('takes the models and voice from server configuration', async () => {
    const h = harness({
      env: {
        BUDDY_VOICE_STT_MODEL: 'openai/whisper-large-v3',
        BUDDY_VOICE_TTS_MODEL: 'google/gemini-3.8-flash-tts',
        BUDDY_VOICE_TTS_VOICE: 'Sulafat',
      },
    });
    await handleVoiceRequest(h.deps, transcribeBody('request-0001'));
    await handleVoiceRequest(h.deps, speakBody('request-0001'));
    expect(h.transcribe.mock.calls[0][0].model).toBe('openai/whisper-large-v3');
    expect(h.synthesize.mock.calls[0][0]).toMatchObject({
      model: 'google/gemini-3.8-flash-tts',
      voice: 'Sulafat',
    });
  });
});
