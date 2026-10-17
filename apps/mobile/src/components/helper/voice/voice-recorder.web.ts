import { VoiceRecorderError, type VoiceRecorder, type VoiceRecording } from './voice-types';

// Formats every current browser's MediaRecorder can produce that
// OpenRouter's transcription endpoint also accepts (webm, m4a/mp4, ogg) —
// so no conversion step is needed. Chrome/Edge/Firefox pick WebM/Opus;
// Safari picks MP4/AAC. The server re-checks the real bytes regardless.
const PREFERRED_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];
/** Plenty for speech, and keeps a full 60-second recording around a quarter of a megabyte. */
const AUDIO_BITS_PER_SECOND = 32_000;

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Asks for the microphone (the browser shows its own permission prompt the
 * first time) and starts recording. The microphone is released the moment
 * `stop()` or `cancel()` is called — the browser's recording indicator goes
 * out immediately, not when the upload finishes.
 */
export async function startVoiceRecording(): Promise<VoiceRecorder> {
  if (!isVoiceRecordingSupported()) throw new VoiceRecorderError('unsupported');

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new VoiceRecorderError('permission_denied');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new VoiceRecorderError('no_microphone');
    }
    throw new VoiceRecorderError('failed');
  }

  const releaseMicrophone = () => stream.getTracks().forEach((track) => track.stop());

  let recorder: MediaRecorder;
  const chunks: Blob[] = [];
  try {
    const mimeType = PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(
      stream,
      mimeType
        ? { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND }
        : { audioBitsPerSecond: AUDIO_BITS_PER_SECOND }
    );
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.start();
  } catch {
    releaseMicrophone();
    throw new VoiceRecorderError('failed');
  }

  const startedAt = performance.now();
  let finished = false;

  return {
    stop() {
      return new Promise<VoiceRecording>((resolve, reject) => {
        if (finished) {
          reject(new VoiceRecorderError('failed'));
          return;
        }
        finished = true;
        const durationMs = Math.round(performance.now() - startedAt);

        recorder.addEventListener(
          'stop',
          () => {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            chunks.length = 0;
            blobToBase64(blob).then(
              (base64) => resolve({ base64, mimeType: blob.type, durationMs }),
              () => reject(new VoiceRecorderError('failed'))
            );
          },
          { once: true }
        );
        recorder.addEventListener('error', () => reject(new VoiceRecorderError('failed')), {
          once: true,
        });

        try {
          // stop() queues the final chunk before the tracks go away.
          recorder.stop();
        } catch {
          reject(new VoiceRecorderError('failed'));
        }
        releaseMicrophone();
      });
    },

    cancel() {
      if (finished) return;
      finished = true;
      try {
        recorder.stop();
      } catch {
        // Already inactive — nothing left to stop.
      }
      releaseMicrophone();
      chunks.length = 0;
    },
  };
}
