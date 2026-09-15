import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { setBoolSetting } from "@/data/settings-core";
import type { Database } from "@/db/client";
import { migratedDatabase } from "@/db/test-database";

jest.mock("./reminders", () => ({
    cancelReminders: jest.fn(async () => undefined),
    pendingReminderIds: jest.fn(async () => ["outlayr.sub-due.a"]),
    reminderPermission: jest.fn(),
    scheduleDatedReminder: jest.fn(async () => undefined),
}));

import * as reminders from "./reminders";
import { syncSubscriptionReminders } from "./subscription-reminder-sync";

const mockReminders = jest.mocked(reminders);

describe("syncSubscriptionReminders", () => {
    let db: Database;

    beforeEach(async () => {
        db = migratedDatabase();
        mockReminders.cancelReminders.mockClear();
        await setBoolSetting(db, "subscriptionReminders", true);
    });

    it("leaves the armed queue alone when the permission could not be read", async () => {
        mockReminders.reminderPermission.mockResolvedValue("unknown");

        await syncSubscriptionReminders(db);

        expect(mockReminders.cancelReminders).not.toHaveBeenCalled();
    });

    it("still silences the queue when the switch is off, whatever the permission", async () => {
        await setBoolSetting(db, "subscriptionReminders", false);
        mockReminders.reminderPermission.mockResolvedValue("unknown");

        await syncSubscriptionReminders(db);

        expect(mockReminders.cancelReminders).toHaveBeenCalledWith(["outlayr.sub-due.a"]);
    });

    it("drops the orphans when the permission is granted and nothing is due", async () => {
        mockReminders.reminderPermission.mockResolvedValue("granted");

        await syncSubscriptionReminders(db);

        expect(mockReminders.cancelReminders).toHaveBeenCalledWith(["outlayr.sub-due.a"]);
    });
});
