import { formatDayHeader } from "./dates";

/**
 * Runs outside the test process, spawned with `TZ` forced by the caller. Jest
 * caches the host's own zone the first time any `Date` is touched, so only a
 * fresh process reads a different one — the same reason `budget-dst-probe.ts`
 * and `clock-dst-probe.ts` exist.
 *
 * ⚠️ `jest/global-setup.js` pins TZ to America/Caracas, which has had no DST
 * since 2007, so no in-process test can reach a clock shift at all.
 *
 * Takes local wall-clock parts rather than epoch milliseconds, because the
 * calling process's own zone would otherwise resolve them to the wrong instant.
 */
const parts = process.argv.slice(2).map(Number);

function localDate(offset: number): Date {
    return new Date(
        parts[offset] ?? 0,
        parts[offset + 1] ?? 0,
        parts[offset + 2] ?? 1,
        parts[offset + 3] ?? 0,
        parts[offset + 4] ?? 0
    );
}

process.stdout.write(formatDayHeader(localDate(0), localDate(5), "en"));
