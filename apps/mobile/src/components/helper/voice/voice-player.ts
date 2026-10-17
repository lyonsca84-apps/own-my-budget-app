import { VoicePlaybackError, type VoiceClip } from './voice-types';

// Native (iOS/Android) fallback — see voice-recorder.ts. Spoken replies are
// built for the web app in this release (voice-player.web.ts).
export function isVoicePlaybackSupported(): boolean {
  return false;
}

export function createVoiceClip(_base64: string, _mimeType: string): VoiceClip {
  throw new VoicePlaybackError('failed');
}
