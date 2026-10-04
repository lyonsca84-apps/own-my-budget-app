import { VoiceRecorderError, type VoiceRecorder } from './voice-types';

// Native (iOS/Android) fallback. Tap-to-talk is built for the web app in
// this release — see voice-recorder.web.ts. Native recording needs a native
// audio module (a new dependency and a rebuild), so here voice reports
// itself unsupported and the Budget Buddy voice controls simply don't show.
export function isVoiceRecordingSupported(): boolean {
  return false;
}

export async function startVoiceRecording(): Promise<VoiceRecorder> {
  throw new VoiceRecorderError('unsupported');
}
