/**
 * Whether a watermark the account just published leaves this device behind.
 *
 * The two numbers count different things, and the off-by-one between them is the
 * whole rule: `sync:currentSeq` serves `syncState.nextSeq`, the sequence number
 * the server will hand to the NEXT accepted row, while the local cursor holds
 * the LAST one applied here. A device that has read the entire log therefore
 * sits exactly one below the watermark, and comparing them directly would wake
 * every device on every push forever — each wake-up costing a round trip and
 * moving nothing.
 *
 * A watermark that is not a whole number is read as "not behind": it did not
 * come from `nextSeq`, and a value this device cannot interpret is not grounds
 * for a round trip. The mount, foreground and local-write triggers still cover
 * whatever it was trying to say.
 */
export function isBehindWatermark(watermark: number, cursor: number): boolean {
    return Number.isSafeInteger(watermark) && watermark - 1 > cursor;
}
