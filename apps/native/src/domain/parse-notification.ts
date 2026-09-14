import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money/catalog";

import { detectDecimalSeparator, parseCsvAmount } from "./transaction-csv";

export interface ParsedNotification {
    amount: number;
    /** The money token as it appeared, e.g. "Bs. 1.250,00", for `detectCurrency`. */
    amountText: string;
    merchant: string | null;
}

function escape(text: string): string {
    return text.replaceAll(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`);
}

const SYMBOLS = [...new Set(Object.values(CURRENCY_META).map((meta) => meta.symbol))]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|");
const CODES = String.raw`(?<![A-Za-z])(?:${PICKABLE_CURRENCY_CODES.join("|")})(?![A-Za-z])`;
const UNIT = `(?:${CODES}|${SYMBOLS})`;
const NUMBER = String.raw`\d+(?:[.,]\d+)*`;
const MONEY = new RegExp(String.raw`${UNIT}\s?${NUMBER}|${NUMBER}\s?${UNIT}`, "u");
const AFTER_NUMBER = /^\d|\s?\d/;

const MERCHANT =
    /\b(?:at|in|en|to|a|de|@)\s+(.+?)(?=\s+(?:with|using|via|on|for|con|usando|por|el|la|desde|mediante)\b|[,.;\n]|$)/iu;

/**
 * Reads a purchase out of a bank or Wallet notification. Null when no money
 * token is found, which is how "your statement is ready" gets skipped.
 */
export function parseNotification(text: string): ParsedNotification | null {
    const match = MONEY.exec(text);
    if (!match) {
        return null;
    }
    const amountText = match[0].trim();
    const amount = parseCsvAmount(amountText, detectDecimalSeparator([amountText]));
    if (amount == null || amount <= 0) {
        return null;
    }
    const tail = text.slice(match.index + match[0].length);
    const merchant = MERCHANT.exec(tail)?.[1]?.trim() || titleMerchant(text, match.index);
    return { amount, amountText, merchant };
}

// ponytail: the first line is the merchant only when the money sits on a later
// line, which is Wallet's own layout; a bank's "Purchase alert" title leaks
// through. An AI pass on misses is the upgrade.
function titleMerchant(text: string, moneyAt: number): string | null {
    const firstLine = text.split("\n", 1)[0]?.trim() ?? "";
    if (!firstLine || moneyAt < firstLine.length || AFTER_NUMBER.test(firstLine)) {
        return null;
    }
    return firstLine;
}
