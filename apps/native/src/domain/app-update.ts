import type { UpdateInfo } from "expo-updates";
import { z } from "zod";

const WhatsNew = z.string();

/** Null for a rollback or a missing update: neither has anything to announce. */
export function describeUpdate(update: UpdateInfo | undefined): { at: Date; id: string; notes: string[] } | null {
    if (!update?.updateId || !update.manifest) {
        return null;
    }
    const extra = "extra" in update.manifest ? update.manifest.extra : undefined;
    const whatsNew = WhatsNew.safeParse(extra?.expoClient?.extra?.whatsNew);
    const lines = whatsNew.success ? whatsNew.data.split("\n").map((line) => line.trim()) : [];
    const notes = [...new Set(lines.filter(Boolean))];
    return { at: update.createdAt, id: update.updateId, notes };
}
