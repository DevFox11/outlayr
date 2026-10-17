/**
 * The AI consent this build asks for, naming Anthropic and ElevenLabs. Sent with
 * every AI request, and the server refuses any other version
 * (`packages/backend/convex/lib/models.ts`). When the providers change, bump it
 * along with the `aiConsentV2` setting key so the question is asked again.
 */
export const AI_CONSENT_VERSION = 2;
