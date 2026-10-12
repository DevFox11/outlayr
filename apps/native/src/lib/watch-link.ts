import { requireOptionalNativeModule } from "expo";

import type { CategoryProps, WatchEntryProps, WeekProps } from "@/widgets/props";

interface WatchLinkModule {
    addListener: (event: "pendingWrite", listener: () => void) => { remove: () => void };
    publish: (snapshot: string) => void;
}

const watchLink = requireOptionalNativeModule<WatchLinkModule>("WatchLink");

export interface WatchSnapshot {
    applied: { ids: string[]; since: number };
    budget: {
        elapsedFraction: number;
        endsAt: number;
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
    categories: CategoryProps[];
    currency: string;
    dateLabel: string;
    entries: WatchEntryProps[];
    labels: {
        all: string;
        average: string;
        empty: string;
        income: string;
        recent: string;
        spent: string;
        week: string;
        yesterday: string;
    };
    money: { cents: boolean; decimal: string; group: string; minorUnits: number; symbol: string };
    publishedAt: number;
    todayLabel: string;
    todaySpent: string;
    week: WeekProps;
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
