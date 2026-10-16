import { getMeta, META_KEYS, setMeta } from "@/data/app-meta-core";
import { isReminderChosen } from "@/data/onboarding-core";
import { setBoolSetting } from "@/data/settings-core";
import type { Database } from "@/db/client";

import { reminderPermission, requestReminderPermission } from "./reminders";

async function arm(db: Database): Promise<void> {
    const [chosen, asked, stored] = await Promise.all([
        getMeta(db, META_KEYS.reminderChosen),
        getMeta(db, META_KEYS.reminderAsked),
        getMeta(db, "showNotifications"),
    ]);
    if (!isReminderChosen(chosen) || asked === "true") {
        return;
    }
    if (stored !== null) {
        // The switch has been set, on or off, since the offer: that is the
        // user's own answer, and it outranks one they gave during onboarding.
        await setMeta(db, META_KEYS.reminderAsked, "true");
        return;
    }
    const existing = await reminderPermission();
    if (existing === "unknown") {
        // The read failed; the next save tries again rather than spending the ask.
        return;
    }
    await setMeta(db, META_KEYS.reminderAsked, "true");
    if (existing === "denied") {
        return;
    }
    // Already granted (by a subscription reminder, or Android before 13) turns
    // it on without a prompt.
    const granted = existing === "granted" ? existing : await requestReminderPermission();
    if (granted === "granted") {
        await setBoolSetting(db, "showNotifications", true);
    }
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Keeps the rhythm step's promise. Taking its reminder offer only records the
 * choice and the evening option: the OS prompt waits for the user's first saved
 * entry, since iOS asks only once. Call it after the user saves a new entry; it
 * asks once and turns the reminder on when it is allowed.
 *
 * Asked once, refused or not, and never over a switch the user has already set
 * in Settings. Serial, so a save landing while the prompt is up waits for its
 * answer instead of asking a second time.
 */
export function armChosenReminder(db: Database): Promise<void> {
    const run = queue.then(() => arm(db));
    queue = run.catch(() => null);
    return run;
}
