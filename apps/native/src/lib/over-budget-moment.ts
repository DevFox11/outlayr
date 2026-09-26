import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

const STORAGE_KEY = "outlayr.over-budget-seen";
const REMEMBERED = 60;

const seenKeys = z.array(z.string());

const claimed = new Set<string>();
let stored: Promise<string[]> | null = null;

async function load(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = seenKeys.safeParse(raw ? JSON.parse(raw) : []);
        return parsed.success ? parsed.data : [];
    } catch {
        return [];
    }
}

function readStored(): Promise<string[]> {
    stored ??= load();
    return stored;
}

export function overBudgetMomentKey(budgetId: string, windowStart: Date): string {
    return `${budgetId}:${windowStart.getTime()}`;
}

export async function claimOverBudgetMoment(key: string): Promise<boolean> {
    if (claimed.has(key)) {
        return false;
    }
    claimed.add(key);
    const seen = await readStored();
    if (seen.includes(key)) {
        return false;
    }
    seen.push(key);
    seen.splice(0, Math.max(0, seen.length - REMEMBERED));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    return true;
}
