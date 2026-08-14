import { beforeEach, describe, expect, it } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";

import type { Database } from "@/db/client";
import { testDatabase } from "@/db/test-database";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import {
    finishOnboarding,
    isOnboardingSettled,
    settleLegacyOnboarding,
    shouldSettleLegacyLedger,
} from "./onboarding-core";

function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
	`);
    return testDatabase(sqlite);
}

describe("onboarding gate", () => {
    it("holds a fresh ledger back", () => {
        expect(isOnboardingSettled(null)).toBe(false);
    });

    it("no longer settles on currency alone — the flow asks more than one question now", () => {
        expect(isOnboardingSettled(null)).toBe(false);
    });

    it("lets a finished run through", () => {
        expect(isOnboardingSettled("true")).toBe(true);
    });

    it("treats anything but an affirmative as unanswered", () => {
        expect(isOnboardingSettled("false")).toBe(false);
        expect(isOnboardingSettled("")).toBe(false);
        expect(isOnboardingSettled("TRUE")).toBe(false);
    });
});

describe("finishOnboarding", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("is the sole writer of onboardingComplete, shared by both terminal paths", async () => {
        await finishOnboarding(db);
        await expect(getMeta(db, META_KEYS.onboardingComplete)).resolves.toBe("true");
    });

    it("settles the gate it writes", async () => {
        await finishOnboarding(db);
        expect(isOnboardingSettled(await getMeta(db, META_KEYS.onboardingComplete))).toBe(true);
    });

    it("is idempotent when a caller runs it more than once", async () => {
        await finishOnboarding(db);
        await finishOnboarding(db);
        await expect(getMeta(db, META_KEYS.onboardingComplete)).resolves.toBe("true");
    });
});

describe("shouldSettleLegacyLedger", () => {
    it("backfills a pre-flow ledger: currency chosen, nothing else written", () => {
        expect(shouldSettleLegacyLedger(null, "true", null)).toBe(true);
    });

    it("leaves a genuinely fresh install alone — there is nothing to backfill", () => {
        expect(shouldSettleLegacyLedger(null, null, null)).toBe(false);
    });

    it("leaves a ledger that already finished the flow itself alone", () => {
        expect(shouldSettleLegacyLedger("true", "true", null)).toBe(false);
    });

    it("never re-fires once migrated, even if it would otherwise qualify", () => {
        expect(shouldSettleLegacyLedger(null, "true", "true")).toBe(false);
    });
});

describe("settleLegacyOnboarding", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("backfills onboardingComplete for a pre-flow ledger and stamps the marker", async () => {
        await setMeta(db, META_KEYS.currencyChosen, "true");

        await settleLegacyOnboarding(db);

        await expect(getMeta(db, META_KEYS.onboardingComplete)).resolves.toBe("true");
        await expect(getMeta(db, META_KEYS.onboardingGateMigrated)).resolves.toBe("true");
    });

    it("stamps the marker even when there is nothing to backfill", async () => {
        await settleLegacyOnboarding(db);

        await expect(getMeta(db, META_KEYS.onboardingComplete)).resolves.toBeNull();
        await expect(getMeta(db, META_KEYS.onboardingGateMigrated)).resolves.toBe("true");
    });

    it("does not touch a ledger that already finished the flow itself", async () => {
        await finishOnboarding(db);

        await settleLegacyOnboarding(db);

        await expect(getMeta(db, META_KEYS.onboardingComplete)).resolves.toBe("true");
        await expect(getMeta(db, META_KEYS.onboardingGateMigrated)).resolves.toBe("true");
    });

    it("is idempotent — a second relaunch writes nothing further", async () => {
        await setMeta(db, META_KEYS.currencyChosen, "true");
        await settleLegacyOnboarding(db);

        await settleLegacyOnboarding(db);

        await expect(getMeta(db, META_KEYS.onboardingComplete)).resolves.toBe("true");
        await expect(getMeta(db, META_KEYS.onboardingGateMigrated)).resolves.toBe("true");
    });
});
