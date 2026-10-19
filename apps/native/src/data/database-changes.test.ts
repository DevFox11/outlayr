import { describe, expect, it } from "@jest/globals";

import { settingChangeReaches } from "./database-changes";

describe("settingChangeReaches", () => {
    it("wakes a keyed listener only for its own keys", () => {
        const reminders = ["hideAmounts", "notificationHour"];
        expect(settingChangeReaches(new Set(["logInsightsTimeFrame", "colorScheme"]), reminders)).toBe(false);
        expect(settingChangeReaches(new Set(["colorScheme", "hideAmounts"]), reminders)).toBe(true);
    });

    it("wakes everyone when a deleted row hid the key, and no one for bookkeeping alone", () => {
        expect(settingChangeReaches(null, ["hideAmounts"])).toBe(true);
        expect(settingChangeReaches(null)).toBe(true);
        expect(settingChangeReaches(new Set())).toBe(false);
        expect(settingChangeReaches(new Set(["colorScheme"]))).toBe(true);
    });
});
