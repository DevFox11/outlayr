import { daysLeftInWindow, hoursLeftInDay } from "./budget-math";

/**
 * Runs outside the test process, spawned with `TZ` forced by the caller. Jest
 * caches the host's own zone the first time any `Date` is touched, so only a
 * fresh process reads a different one — the same reason `clock-dst-probe.ts`
 * exists.
 *
 * Takes local wall-clock parts rather than epoch milliseconds, because the
 * calling process's own zone would otherwise resolve them to the wrong instant.
 */
const [kind = "", ...rest] = process.argv.slice(2);
const parts = rest.map(Number);

function localDate(offset: number): Date {
    return new Date(
        parts[offset] ?? 0,
        parts[offset + 1] ?? 0,
        parts[offset + 2] ?? 1,
        parts[offset + 3] ?? 0,
        parts[offset + 4] ?? 0
    );
}

const window = { end: localDate(0), start: localDate(5) };
const now = localDate(10);

process.stdout.write(String(kind === "days" ? daysLeftInWindow(window, now) : hoursLeftInDay(window, now)));
