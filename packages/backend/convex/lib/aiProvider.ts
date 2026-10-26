import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

// DeepSeek serves the Anthropic wire format, so the existing provider works with a base URL swap.
// https://api-docs.deepseek.com/guides/anthropic_api
const DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic";

/** Read live so clearing the key with `npx convex env set` takes effect on the next call. */
export function aiApiKey(): string | undefined {
    return process.env.DEEPSEEK_API_KEY;
}

export function aiConfigured(): boolean {
    return aiApiKey() !== undefined;
}

export function aiProvider() {
    return createAnthropic({
        apiKey: aiApiKey(),
        baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    });
}

/** The concrete model object: `LanguageModel` also admits a bare provider id, which callers never pass here. */
export type AgentModel = Extract<LanguageModel, { specificationVersion: "v4" }>;

export function languageModel(modelId: string): AgentModel {
    return aiProvider()(modelId);
}

const THINKING_DISABLED = { anthropic: { thinking: { type: "disabled" } } } as const;

/**
 * DeepSeek runs thinking by default, and the extraction calls want the answer rather than the
 * reasoning. `reasoning` from the AI SDK cannot express "off" (it only maps to a budget), so the
 * provider option is the lever. Set AI_THINKING=enabled to let a call think on the provider default.
 */
export function aiProviderOptions(): typeof THINKING_DISABLED | undefined {
    return process.env.AI_THINKING === "enabled" ? undefined : THINKING_DISABLED;
}
