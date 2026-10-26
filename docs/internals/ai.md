# AI providers

One provider: DeepSeek, through its Anthropic-compatible endpoint (`https://api.deepseek.com/anthropic`).
`@ai-sdk/anthropic` stays in place, so the image parts, the hosted web search tool and the tool-shaped
structured output all keep working, and the unit tests keep their `vi.mock("@ai-sdk/anthropic")`.

## Models

Both tiers run `deepseek-flash` (DeepSeek-V4.1-Flash-1017). It is the only one of the two models with
vision, and the receipt and installment scans send photos. `deepseek-v4-pro` is stronger but has no
vision and costs two to four times as much, so nothing routes to it today.

Overrides are read per call, like the rest of the provider keys: `AI_MODEL_ID`, `AI_FAST_MODEL_ID`,
`AI_GROUNDED_MODEL_ID`. `lib/models.ts` holds the defaults and the tier getters.

| Call | Tier |
|---|---|
| `receiptScan`, `installmentScan` | fast (vision) |
| `csvImport`, `enrichment`, `enrichmentQueue` | fast |
| `groundedLookup` | grounded (fast today) |
| `voiceEntry` (agent) | main (fast today) |

## Settings

- `DEEPSEEK_API_KEY` is read live in `lib/ai-provider.ts`, so `npx convex env set` takes effect on the
  next call. Without it the actions answer `notConfigured` instead of throwing.
- `DEEPSEEK_BASE_URL` is optional and only there for a proxy or a self-hosted gateway.
- `AI_THINKING=enabled` lets a call think on the provider default. Everything else disables thinking.

## Thinking is on by default

DeepSeek runs thinking unless told otherwise. The AI SDK's `reasoning` option cannot express "off": it
only maps to a token budget, and `"none"` is not even a key there, so the call sites pass
`providerOptions: { anthropic: { thinking: { type: "disabled" } } }` instead. Leaving it on would pay
for reasoning tokens on every receipt and every CSV row.

## Pricing and the budget

`lib/spend.ts` charges the grounded budget from DeepSeek's list prices: $0.75 per 1,000 Search calls,
$0.30 per 1M input tokens and $1.20 per 1M output tokens. Those are the peak-hour rates; off-peak
halves them, so the budget is charged a ceiling rather than the real spend. `GROUNDED_*` env vars move
each of them without a deploy.

## Grounding

`groundedLookup` still uses the provider's hosted `web_search` tool. DeepSeek's compatibility table
lists `server_tool_use` and `web_search_tool_result` as supported, so the request shape is unchanged.
The alternative is DeepSeek's own Search and Fetch APIs (`/v1/tools/search`, `/v1/tools/fetch`), which
are billed per request and would mean fetching results ourselves instead of letting the model search.

## What DeepSeek cannot do

Speech to text. `voiceEntry` transcribes with ElevenLabs (`scribe_v2`) and only then sends the
transcript to DeepSeek. The consent copy says exactly that.

## Consent

`AI_CONSENT_VERSION` is 3 in `lib/models.ts` and mirrored in `apps/native/src/domain/ai-consent.ts`.
The stored answer moved to the `aiConsentV3` setting key, so everyone who allowed v2 is asked again
before any data reaches the new provider. The permission strings in `app.config.ts` and the consent
copy name DeepSeek (and ElevenLabs for voice); the privacy policy lists DeepSeek as a processor and
states that it processes the data in China, as its own policy says.

## Live tests

`RUN_LIVE_MODEL_TESTS=1` plus `DEEPSEEK_API_KEY`, and `ELEVENLABS_API_KEY` for the voice one. They are
skipped without both, so CI never spends tokens.
