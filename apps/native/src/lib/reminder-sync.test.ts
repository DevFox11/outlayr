import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { Database } from "@/db/client";
import { migratedDatabase } from "@/db/test-database";

import { freshEntries } from "./fresh-entries";
import { useDailyReminderSync } from "./reminder-sync";
import { PUBLISH_DEBOUNCE_MS } from "./sync-cadence";

type ChangeListener = (event: { tableName: string }) => void;

const mockChangeListeners = new Set<ChangeListener>();
jest.mock("expo-sqlite", () => ({
    addDatabaseChangeListener: (listener: ChangeListener) => {
        mockChangeListeners.add(listener);
        return {
            remove: () => {
                mockChangeListeners.delete(listener);
            },
        };
    },
}));

const mockArm = jest.fn<(db: Database) => Promise<void>>(async () => undefined);
jest.mock("./chosen-reminder", () => ({
    armChosenReminder: (db: Database) => mockArm(db),
}));
jest.mock("./reminders", () => ({
    cancelReminders: async () => undefined,
    pendingReminderIds: async () => [],
    reminderPermission: async () => "undetermined",
    scheduleDatedReminder: async () => undefined,
}));
jest.mock("@/lib/use-foreground-sweep", () => ({ useForegroundSweep: () => undefined }));

describe("useDailyReminderSync", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockArm.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("arms the onboarding reminder on the user's own save, not on any write to the ledger", async () => {
        const db = migratedDatabase();
        await renderHook(() => useDailyReminderSync(db));

        // A sync pull, sign-in adoption or logo update writes the table too.
        await act(async () => {
            for (const listener of mockChangeListeners) {
                listener({ tableName: "transactions" });
            }
            jest.advanceTimersByTime(PUBLISH_DEBOUNCE_MS);
        });
        expect(mockArm).not.toHaveBeenCalled();

        await act(async () => {
            freshEntries.mark("t1");
            jest.advanceTimersByTime(PUBLISH_DEBOUNCE_MS);
        });
        expect(mockArm).toHaveBeenCalledTimes(1);
    });
});
