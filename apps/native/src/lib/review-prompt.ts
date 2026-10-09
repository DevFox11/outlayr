import AsyncStorage from "@react-native-async-storage/async-storage";
import { count, countDistinct, isNull, sql } from "drizzle-orm";
import { isAvailableAsync, requestReview } from "expo-store-review";
import { AppState } from "react-native";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";

import { APP_VERSION } from "./app-version";

const ASKED_VERSION_KEY = "outlayr.review-asked-version";
const MIN_ENTRIES = 10;
const MIN_DAYS = 3;

async function engaged(db: Database): Promise<boolean> {
    const [ledger] = await db
        .select({
            days: countDistinct(sql`date(${transactions.updatedAt} / 1000, 'unixepoch', 'localtime')`),
            entries: count(),
        })
        .from(transactions)
        .where(isNull(transactions.deletedAt));
    return (ledger?.entries ?? 0) >= MIN_ENTRIES && (ledger?.days ?? 0) >= MIN_DAYS;
}

export async function askForReview(db: Database): Promise<void> {
    if (AppState.currentState !== "active" || (await AsyncStorage.getItem(ASKED_VERSION_KEY)) === APP_VERSION) {
        return;
    }
    if (!((await isAvailableAsync()) && (await engaged(db)))) {
        return;
    }
    await AsyncStorage.setItem(ASKED_VERSION_KEY, APP_VERSION);
    await requestReview();
}
