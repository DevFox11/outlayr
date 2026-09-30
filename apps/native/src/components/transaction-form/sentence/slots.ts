/**
 * Every fact the sentence states. A template must reference all of these and
 * nothing else, in whatever order its language wants — `slots.test.ts` holds
 * each locale to it, so a new language that drops a slot fails at build time
 * rather than rendering an entry with a fact silently missing.
 */
export const TRANSACTION_SENTENCE_SLOTS = ["account", "amount", "category", "kind", "merchant", "when"] as const;

export type TransactionSentenceSlot = (typeof TRANSACTION_SENTENCE_SLOTS)[number];

export const TRANSACTION_RATE_SLOTS = ["converted", "rateSource"] as const;

export type TransactionRateSlot = (typeof TRANSACTION_RATE_SLOTS)[number];

export type TransactionSentenceMark = TransactionRateSlot | TransactionSentenceSlot | "fee";

export const TRANSACTION_SENTENCE_KEYS = ["transaction.sentence.expense", "transaction.sentence.income"] as const;

export const TRANSACTION_RATE_SENTENCE_KEYS = [
    "transaction.sentence.rate.custom",
    "transaction.sentence.rate.provider",
] as const;

const CLOSING_STOP = /\.\s*$/;

export function continueSentence(sentence: string, clause: string): string {
    return `${sentence.replace(CLOSING_STOP, "")}${clause}`;
}
