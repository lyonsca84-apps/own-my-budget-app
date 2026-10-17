/** One finished recording, held in memory only until it has been sent. */
export interface VoiceRecording {
  /** Raw base64 of the audio file (no `data:` prefix). */
  base64: string;
  mimeType: string;
  durationMs: number;
}

export interface VoiceRecorder {
  /** Stops capture, releases the microphone straight away, and resolves with the recording. */
  stop(): Promise<VoiceRecording>;
  /** Stops capture and releases the microphone, discarding the audio. */
  cancel(): void;
}

export type VoiceRecorderErrorCode =
  'unsupported' | 'permission_denied' | 'no_microphone' | 'failed';

export class VoiceRecorderError extends Error {
  constructor(public readonly code: VoiceRecorderErrorCode) {
    super(`Voice recording failed: ${code}`);
  }
}

/** One spoken reply, playable more than once without another request. */
export interface VoiceClip {
  /** Plays from the start. Rejects with VoicePlaybackError if playback can't begin. */
  play(onEnded: () => void): Promise<void>;
  stop(): void;
  /** Stops playback and frees the audio (and its object URL). The clip can't be used afterwards. */
  dispose(): void;
}

/** `blocked` = the browser's autoplay policy wants a tap first; the clip itself is fine. */
export type VoicePlaybackErrorCode = 'blocked' | 'failed';

export class VoicePlaybackError extends Error {
  constructor(public readonly code: VoicePlaybackErrorCode) {
    super(`Voice playback failed: ${code}`);
  }
}
