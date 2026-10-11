import { requireOptionalNativeModule } from "expo";
import { z } from "zod";

import { applyWatchNotes } from "@/data/pending-writes-core";
import type { Database } from "@/db/client";

import { sharedStore } from "./shared-store";

interface WatchLinkModule {
    addListener: (event: "pendingWrite", listener: () => void) => { remove: () => void };
    publish: (snapshot: string) => void;
}

const watchLink = requireOptionalNativeModule<WatchLinkModule>("WatchLink");

export const WATCH_NOTES_KEY = "watchNotes";

export interface WatchSnapshot {
    budget: {
        elapsedFraction: number;
        isOverall: boolean;
        name: string;
        over: boolean;
        percent: string;
        periodLabel: string;
        present: boolean;
        remaining: string;
        remainingCaption: string;
        spentFraction: number;
    };
    categories: { color: string; emoji: string; id: string; income: boolean; name: string }[];
    currency: string;
    dateLabel: string;
    entries: { amount: string; color: string; day: string; emoji: string; id: string; income: boolean; note: string }[];
    labels: {
        done: string;
        empty: string;
        expense: string;
        income: string;
        log: string;
        logged: string;
        next: string;
        note: string;
        recent: string;
        spent: string;
    };
    money: { decimal: string; group: string; minorUnits: number; symbol: string };
    publishedAt: number;
    todayLabel: string;
    todaySpent: string;
    zeroSpent: string;
}

export function publishWatchSnapshot(snapshot: WatchSnapshot): void {
    try {
        watchLink?.publish(JSON.stringify(snapshot));
    } catch (error) {
        console.warn("[outlayr] watch snapshot failed", error);
    }
}

export function onWatchPendingWrite(listener: () => void): () => void {
    const subscription = watchLink?.addListener("pendingWrite", listener);
    return () => subscription?.remove();
}

const watchNotesSchema = z.record(z.string(), z.string());

function readWatchNotes(): Record<string, string> {
    try {
        const parsed = watchNotesSchema.safeParse(JSON.parse(sharedStore?.get(WATCH_NOTES_KEY) ?? "{}"));
        return parsed.success ? parsed.data : {};
    } catch {
        return {};
    }
}

export async function drainWatchNotes(db: Database): Promise<void> {
    const notes = readWatchNotes();
    if (Object.keys(notes).length === 0) {
        return;
    }
    const applied = await applyWatchNotes(db, notes);
    const left = Object.fromEntries(Object.entries(readWatchNotes()).filter(([id]) => !applied.includes(id)));
    if (Object.keys(left).length === 0) {
        sharedStore?.remove(WATCH_NOTES_KEY);
    } else {
        sharedStore?.set(WATCH_NOTES_KEY, JSON.stringify(left));
    }
}
