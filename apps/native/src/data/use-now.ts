import { getTableName } from "drizzle-orm";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { transactions, transfers } from "@/db/schema";
import { clockAdvances, nextClockTick } from "@/domain/clock";

import { subscribeToTableChanges } from "./database-changes";

const BOUNDED_TABLES: string[] = [getTableName(transactions), getTableName(transfers)];
const MOUNT_RESTATE_AFTER_MS = 60_000;

let readingMs = Date.now();
let midnightTimer: ReturnType<typeof setTimeout> | null = null;
let teardown: (() => void)[] = [];
const subscribers = new Set<() => void>();

function publish(candidateMs: number): void {
    if (!clockAdvances(readingMs, candidateMs)) {
        return;
    }
    readingMs = candidateMs;
    // Iterated over a copy: a screen that unmounts on this notification would
    // otherwise skip the subscriber after it.
    // oxlint-disable-next-line unicorn/no-useless-spread -- a notified screen can unmount and unsubscribe, which would skip the subscriber after it
    for (const notify of [...subscribers]) {
        notify();
    }
}

function armMidnight(): void {
    if (midnightTimer != null) {
        clearTimeout(midnightTimer);
    }
    midnightTimer = setTimeout(() => {
        midnightTimer = null;
        publish(Date.now());
        armMidnight();
    }, nextClockTick(Date.now()));
}

function start(): void {
    armMidnight();

    const phase = AppState.addEventListener("change", (state) => {
        if (state === "active") {
            publish(Date.now());
            // JS timers do not run while the app is backgrounded, so the pending one
            // is armed for a midnight that may already have gone by.
            armMidnight();
        }
    });
    const changes = BOUNDED_TABLES.map((tableName) =>
        subscribeToTableChanges(tableName, () => {
            publish(Date.now());
        })
    );

    teardown = [() => phase.remove(), ...changes];
}

function stop(): void {
    if (midnightTimer != null) {
        clearTimeout(midnightTimer);
        midnightTimer = null;
    }
    for (const off of teardown) {
        off();
    }
    teardown = [];
}

function subscribe(notify: () => void): () => void {
    // A screen mounting is itself a reason to restate the reading: it is about to
    // read the ledger, and the standing one can be an hour old. Not a fresher one
    // than that, though: each restatement re-renders every screen bounded by it.
    const nowMs = Date.now();
    if (nowMs - readingMs > MOUNT_RESTATE_AFTER_MS) {
        publish(nowMs);
    }
    subscribers.add(notify);
    if (subscribers.size === 1) {
        start();
    }

    return () => {
        subscribers.delete(notify);
        if (subscribers.size === 0) {
            stop();
        }
    };
}

function read(): number {
    return readingMs;
}

/**
 * The one reading of "now" every date-bounded read in the app shares. A screen
 * that freezes its own `Date.now()` at mount puts a row saved after that mount
 * past the ledger's `lte(date, now)` bound and under `useUpcomingTransactions`,
 * since a transaction's date is `new Date()` at *form* mount.
 *
 * It moves on a write to `transactions` or `transfers` — both are date-bounded
 * ledger reads — on returning to the foreground, and at local midnight. A
 * transfer with no fee touches only `transfers`, so leaving it out hid every
 * such row until the next tick. Store state rather than per-hook state so the
 * listeners are installed once for the app, not once per screen reading it.
 */
export function useNow(): number {
    return useSyncExternalStore(subscribe, read);
}
