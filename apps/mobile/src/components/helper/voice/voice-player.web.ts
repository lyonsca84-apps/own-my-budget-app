import { VoicePlaybackError, type VoiceClip } from './voice-types';

export function isVoicePlaybackSupported(): boolean {
  return (
    typeof Audio !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

/**
 * Wraps one spoken reply in an in-memory object URL so it can be replayed
 * without asking the server (and paying) again. `dispose()` revokes the
 * URL; nothing is written to storage.
 */
export function createVoiceClip(base64: string, mimeType: string): VoiceClip {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const audio = new Audio(url);
  let disposed = false;

  const detach = () => {
    audio.onended = null;
    audio.onerror = null;
  };

  return {
    async play(onEnded) {
      if (disposed) throw new VoicePlaybackError('failed');
      const finish = () => {
        detach();
        onEnded();
      };
      audio.onended = finish;
      // A decode failure part-way through ends the clip rather than hanging.
      audio.onerror = finish;
      audio.currentTime = 0;
      try {
        await audio.play();
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        // AbortError just means stop()/dispose() won the race — not a failure.
        if (name === 'AbortError') return;
        detach();
        throw new VoicePlaybackError(name === 'NotAllowedError' ? 'blocked' : 'failed');
      }
    },

    stop() {
      detach();
      audio.pause();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      detach();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
    },
  };
}
