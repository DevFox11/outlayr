export const CLAUDE_MODEL_ID = "claude-sonnet-5-5";
export const CLAUDE_FAST_MODEL_ID = "claude-haiku-5-5";
export const ELEVENLABS_TRANSCRIPTION_MODEL_ID = "scribe_v2";

/**
 * The consent the app asked for, naming the providers above. Bump it whenever
 * they change: a request carrying any other value never reaches a provider, so
 * a build that asked about the old providers cannot send data to the new ones.
 * Mirrored in `apps/native/src/domain/ai-consent.ts`.
 */
export const AI_CONSENT_VERSION = 2;
