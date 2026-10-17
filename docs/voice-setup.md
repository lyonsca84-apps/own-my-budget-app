# Budget Buddy voice (tap-to-talk) setup

## Status: deployed and switched ON for project `soapkqeaodjawxrvslob` (2026-10-04)

Deployed on 2026-10-04: the ledger migration, both functions, and the `OPENROUTER_API_KEY` and `BUDDY_VOICE_ENABLED=true` secrets. A signed-in voice turn with a real microphone has not been verified live yet. The code default is still OFF — a new environment stays dark until the steps under [Turning it on](#turning-it-on) are done.

Turn-based voice for the existing Budget Buddy: tap **Talk to Buddy**, speak, tap **Done**. The recording is transcribed, the transcript goes into the same conversation as a typed message, the existing Budget Buddy answers, and the answer is read aloud. No continuous listening, no live/Realtime connection.

Nothing changes for customers until the three deployment steps under [Turning it on](#turning-it-on) are done.

## How a turn works

| Step             | Where                                                 | Provider                                  |
| ---------------- | ----------------------------------------------------- | ----------------------------------------- |
| 1. Record        | Browser `MediaRecorder` (WebM/Opus, or MP4 on Safari) | —                                         |
| 2. Speech → text | `budget-buddy-voice` `{ action: 'transcribe' }`       | OpenRouter `/api/v1/audio/transcriptions` |
| 3. Reasoning     | existing `budget-buddy-chat`, with `mode: 'voice'`    | Anthropic (unchanged model)               |
| 4. Text → speech | `budget-buddy-voice` `{ action: 'speak' }`            | OpenRouter `/api/v1/audio/speech`         |
| 5. Play / replay | Browser `Audio`, from an in-memory object URL         | —                                         |

Step 3 is the same function, model (`BUDGET_BUDDY_MODEL` in `_shared/ai-config.ts`), financial snapshot, and `budgetBuddyAction` allowance as typed chat. Voice mode only appends delivery rules to the system prompt (2–4 plain sentences, one follow-up question, education not advice, confirm anything ambiguous in the transcript, never invent figures) and lowers the reply ceiling to `MAX_TOKENS_VOICE_CHAT`.

Voice explains and guides only. Budget Buddy still cannot change any data, by voice or by typing.

## Models and voice

| Purpose        | Default                                     | Env var                  |
| -------------- | ------------------------------------------- | ------------------------ |
| Transcription  | `openai/gpt-4o-mini-transcribe`             | `BUDDY_VOICE_STT_MODEL`  |
| Speech         | `microsoft/mai-voice-2.1-flash`             | `BUDDY_VOICE_TTS_MODEL`  |
| Voice          | `en-US-Harper:MAI-Voice-2.1-Flash`          | `BUDDY_VOICE_TTS_VOICE`  |
| Audio format   | `mp3` (`pcm` is wrapped as WAV server-side) | `BUDDY_VOICE_TTS_FORMAT` |
| Delivery style | warm, calm, encouraging, plain-spoken       | `BUDDY_VOICE_TTS_STYLE`  |

### Why the voice is not an OpenAI voice

The brief asked for `openai/gpt-4o-mini-tts-2025-12-15`. Checked against OpenRouter on **2026-10-04**: that model no longer exists there (a live request returns `Model openai/gpt-4o-mini-tts-2025-12-15 does not exist`), and **no OpenAI model is served on `/api/v1/audio/speech` at all** — the catalogue (`GET /api/v1/models?output_modalities=speech`) lists 23 speech models from Microsoft, Google, Deepgram, Mistral, MiniMax, xAI and others. OpenRouter's own docs still use the old model name in examples; the catalogue and the live API are what's true. Transcription _is_ OpenAI.

The default was picked from live tests of what is available:

- `microsoft/mai-voice-2.1-flash` — returns MP3 directly, about 0.6–2 s for a short reply. No tone parameter; the voice itself is calm.
- `google/gemini-3.8-flash-tts` — has a documented tone control, but only returns raw PCM and took about 4.7 s for the same reply.

Speed won, since the reply already waits on transcription and reasoning. To switch, change the env vars — no code change. The server already sends the tone instruction in both documented provider shapes (`provider.options.openai.instructions` and `provider.options.google-ai-studio.speech_metadata.style`), and OpenRouter forwards only the block for the provider that serves the model. So if an OpenAI speech model returns to OpenRouter:

```
BUDDY_VOICE_TTS_MODEL=openai/<model id from the catalogue>
BUDDY_VOICE_TTS_VOICE=<a voice from that model's supported_voices>
```

### OpenRouter differences from OpenAI's API (verified, not assumed)

- Transcription takes JSON with base64 audio (`input_audio: { data, format }`), not a multipart upload (multipart is also accepted, but unused here).
- Speech supports only `mp3` or `pcm` output, and returns raw audio bytes with **no usage or cost** in the response.
- A tone instruction is a per-provider option, not a top-level `instructions` field.
- Voices are model-specific; the list is each model's `supported_voices` in the catalogue.

## Limits (all enforced server-side)

| Limit                                 | Default                          | Env var                                                         |
| ------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| Voice messages / month — Free         | 0 (voice is a paid-plan feature) | `BUDDY_VOICE_MONTHLY_TURNS_FREE`                                |
| Voice messages / month — Guided       | 20                               | `BUDDY_VOICE_MONTHLY_TURNS_GUIDED`                              |
| Voice messages / month — Budget Buddy | 100                              | `BUDDY_VOICE_MONTHLY_TURNS_BUDGET_BUDDY`                        |
| Spoken replies / month                | 0 / 40 / 200                     | `BUDDY_VOICE_MONTHLY_SPOKEN_REPLIES_{FREE,GUIDED,BUDGET_BUDDY}` |
| Recording length                      | 60 s (cannot be raised above 60) | `BUDDY_VOICE_MAX_RECORDING_SECONDS`                             |
| Recording size                        | 2 MB                             | `BUDDY_VOICE_MAX_AUDIO_BYTES`                                   |
| Spoken reply length                   | 600 characters                   | `BUDDY_VOICE_MAX_REPLY_CHARS`                                   |
| Rate limit                            | 6 per minute, per user, per kind | `BUDDY_VOICE_RATE_LIMIT_PER_MINUTE`                             |
| Provider timeouts                     | 30 s each                        | `BUDDY_VOICE_STT_TIMEOUT_MS`, `BUDDY_VOICE_TTS_TIMEOUT_MS`      |
| App-wide voice spend / month          | $25                              | `BUDDY_VOICE_MONTHLY_BUDGET_USD`                                |

Notes:

- Every voice message also uses one `budgetBuddyAction`, exactly like a typed message. Prices, plans, and trial terms are untouched; no plan is ever unlimited.
- When a voice limit is reached the customer gets a calm message and **typed chat keeps working**.
- A reply longer than the spoken limit is cut at a sentence end for audio only; the written reply is always complete.
- Numbers are clamped, so a typo in an env var cannot remove a limit.

### How limits are enforced

`voice_usage_ledger` (migration `20261004140000`) holds one row per provider call. `reserve_voice_usage` checks duplicate request → monthly allowance → rate limit → app-wide spend, and writes the reservation, in **one transaction under a per-user advisory lock** — two simultaneous taps cannot both pass. `finalize_voice_usage` then settles the row:

- `completed` — counted, with the provider-reported cost when there is one.
- `cancelled` — still counted; the provider may already have charged.
- `failed` — not counted; the allowance is handed back.

Known bound: the app-wide spend check is not locked across _different_ users, so simultaneous requests can overshoot the monthly budget by their own estimated cost (fractions of a cent each).

There are no automatic retries anywhere. A retry is always a new, explicit tap. A warm-instance circuit breaker stops calls into a provider that is already failing.

### Cost: reported vs estimated

`voice_usage_ledger.cost_source` says which is which:

- **Transcription — `reported`.** OpenRouter returns `usage.cost` per request.
- **Speech — `estimated`.** The speech endpoint returns audio only, so cost is `characters × BUDDY_VOICE_TTS_USD_PER_CHAR` (default `0.000015`, the catalogue price for the default model). **Update this rate if you change the speech model**, or the spend cap will be measuring the wrong thing.
- **Reasoning** is not in this ledger; it stays counted by `feature_usage.budgetBuddyAction`.

Measured on 2026-10-04: a ~6 s question cost about $0.0002 to transcribe (reported); a 90-character reply about $0.0013 to speak (estimated).

```sql
-- Voice spend this month, split by kind and by how the cost is known
select kind, cost_source, count(*) as calls, sum(cost_micro_usd) / 1e6 as usd
from voice_usage_ledger
where status <> 'failed' and created_at >= date_trunc('month', now())
group by 1, 2;
```

## Security and data handling

- Both OpenRouter calls run only inside the `budget-buddy-voice` Edge Function. It verifies the session first, on every request, then the kill switch, then plan entitlement, then the upload, then limits.
- The caller is always the user in the verified session. A user id in a request body is never read.
- `OPENROUTER_API_KEY` is read only via `Deno.env` server-side. It is not in the app bundle, any `EXPO_PUBLIC_` variable, localStorage, logs, or source control. Customers never need a key.
- Recordings are identified by their actual bytes (WebM, Ogg, MP4/M4A, WAV, MP3), not the claimed type, and size is checked before decoding.
- **Audio is never stored.** Recordings and generated speech exist in memory for one request. The ledger holds counts, durations, character counts and cost — no audio, transcripts, reply text, or budget data.
- Logs carry metadata only (event, request id, latency, HTTP status).
- Conversation retention is unchanged: chat history lives only in the client's memory. The browser releases the microphone the moment recording stops, is cancelled, or the panel closes, and revokes the audio object URL when the conversation moves on.

## Turning it on

Production deployment is a separate, deliberate step. In order:

1. **Apply the migration** `supabase/migrations/20261004140000_voice_usage_ledger.sql`:

   For project `soapkqeaodjawxrvslob` this is already done. **Do not run `supabase db push` against that project:** its migrations were applied through the Supabase connection, so their remote version stamps differ from the local filenames, and `db push` would try to re-apply every migration. Apply new migrations there by running the file's SQL (dashboard SQL editor, or the Supabase connection). `supabase db push` is only right for a fresh project whose history matches these filenames.

2. **Set the secrets.** `OPENROUTER_API_KEY` is the same server-side key the orchestration layer uses; skip it if it is already set (`supabase secrets list`). Never paste a real key into a chat with an AI assistant.

   ```bash
   supabase secrets set OPENROUTER_API_KEY=<your-openrouter-key> --project-ref soapkqeaodjawxrvslob
   supabase secrets set BUDDY_VOICE_ENABLED=true --project-ref soapkqeaodjawxrvslob
   ```

   Every other `BUDDY_VOICE_*` variable is optional. For local `supabase functions serve`, put the same names in the root `.env` (see `.env.example`); `npm run setup:openrouter` writes the key there safely.

3. **Deploy the two functions** (the chat function changed too — it gained voice mode):

   ```bash
   supabase functions deploy budget-buddy-voice --project-ref soapkqeaodjawxrvslob
   supabase functions deploy budget-buddy-chat --project-ref soapkqeaodjawxrvslob
   ```

**To turn it off:** `supabase secrets set BUDDY_VOICE_ENABLED=false`. The voice controls disappear on the next load; typed chat is unaffected. No redeploy needed.

Recommended in the OpenRouter dashboard: a credit limit on the key (a hard backstop behind the app's own spend cap), and the privacy setting that denies training on your data.

## Where it appears

Inside the existing Budget Buddy composer (`components/helper/budget-buddy-chat.tsx`), so in both the floating panel on wide layouts and the full-screen `/helper` route. Controls: Talk to Buddy, Done, Cancel recording, Stop audio, Replay (and Listen for a typed reply), Play reply (when the browser blocks autoplay), Spoken replies on/off, plus a recording timer and the line "Budget Buddy uses an AI-generated voice."

**Web only in this release.** On iOS/Android the controls do not render: native recording needs a native audio module (a new dependency and a native rebuild). `voice/voice-recorder.ts` and `voice/voice-player.ts` are the two files to implement for native.

## Budget Missions

`buildMissionContext` in `budget-buddy-chat/index.ts` is the integration boundary: it adds the caller's own started missions (title, description, app-set status) to the snapshot, read-only. The system prompt lets Budget Buddy explain a mission and discuss consequences, and forbids awarding or announcing points, badges, or completion. There are no mission rules in the app yet, so none are invented here; when they ship, add the app-computed state in that one function.

## Testing

- `packages/ai-orchestrator/src/__tests__/voice.test.ts` — the request handler with mocked providers: authentication, authorization, entitlement, usage enforcement, malformed uploads, duplicate submissions, cost attribution, privacy of logs.
- `voiceCoreSync.test.ts` — fails if the deployed copy (`supabase/functions/_shared/voice-core.ts`) differs from the tested source (`packages/ai-orchestrator/src/voice.ts`). **Edit `voice.ts`, then copy it over the Deno file.**
- `packages/api/src/__tests__/edge-functions.test.ts` — the client wrappers.

Verified by hand on 2026-10-04 (not in CI): the migration on Postgres 18 (limits, duplicates, rate limit, spend cap, RLS, direct-call lockout); a live speak → transcribe round trip, timeout, cancel, failed speech, and unreadable audio against OpenRouter; and the recorder/player in headless Chrome, including a real WebM/Opus recording transcribed by the live model.

**Not yet tested:** the deployed Edge Function itself (Deno runtime); the full flow in the running app with a real microphone; Safari and Firefox; mobile browsers; an MP4/AAC (Safari) recording against the live model; screen-reader behaviour.
