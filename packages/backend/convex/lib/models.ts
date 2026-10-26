// DeepSeek V4.1 Flash (1017) serves every tier: it is the only one of the two models with vision.
// https://api-docs.deepseek.com/quick_start/pricing
export const AI_MODEL_ID = "deepseek-flash";
export const AI_FAST_MODEL_ID = "deepseek-flash";
export const AI_GROUNDED_MODEL_ID = "deepseek-flash";
export const ELEVENLABS_TRANSCRIPTION_MODEL_ID = "scribe_v2";

// The provider does not know these ids, so it caps output at 4096 tokens unless asked otherwise.
// A 200-row CSV import can exceed that; the cap only limits, it never charges.
export const AI_MAX_OUTPUT_TOKENS = 16_384;

// Bump whenever the providers above change, so a build that asked about the old ones cannot send data to new ones.
// Mirrored in apps/native/src/domain/ai-consent.ts.
export const AI_CONSENT_VERSION = 3;

export function mainModelId(): string {
    return process.env.AI_MODEL_ID || AI_MODEL_ID;
}

export function fastModelId(): string {
    return process.env.AI_FAST_MODEL_ID || AI_FAST_MODEL_ID;
}

export function groundedModelId(): string {
    return process.env.AI_GROUNDED_MODEL_ID || AI_GROUNDED_MODEL_ID;
}
