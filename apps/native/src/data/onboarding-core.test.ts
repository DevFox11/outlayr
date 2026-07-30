import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
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
	return drizzle(sqlite) as unknown as Database;
}

describe("onboarding gate", () => {
	it("holds a fresh ledger back", () => {
		assert.equal(isOnboardingSettled(null), false);
	});

	it("no longer settles on currency alone — the flow asks more than one question now", () => {
		assert.equal(isOnboardingSettled(null), false);
	});

	it("lets a finished run through", () => {
		assert.equal(isOnboardingSettled("true"), true);
	});

	it("treats anything but an affirmative as unanswered", () => {
		assert.equal(isOnboardingSettled("false"), false);
		assert.equal(isOnboardingSettled(""), false);
		assert.equal(isOnboardingSettled("TRUE"), false);
	});
});

describe("finishOnboarding", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("is the sole writer of onboardingComplete, shared by both terminal paths", async () => {
		await finishOnboarding(db);
		assert.equal(await getMeta(db, META_KEYS.onboardingComplete), "true");
	});

	it("settles the gate it writes", async () => {
		await finishOnboarding(db);
		assert.equal(
			isOnboardingSettled(await getMeta(db, META_KEYS.onboardingComplete)),
			true,
		);
	});

	it("is idempotent when a caller runs it more than once", async () => {
		await finishOnboarding(db);
		await finishOnboarding(db);
		assert.equal(await getMeta(db, META_KEYS.onboardingComplete), "true");
	});
});

describe("shouldSettleLegacyLedger", () => {
	it("backfills a pre-flow ledger: currency chosen, nothing else written", () => {
		assert.equal(shouldSettleLegacyLedger(null, "true", null), true);
	});

	it("leaves a genuinely fresh install alone — there is nothing to backfill", () => {
		assert.equal(shouldSettleLegacyLedger(null, null, null), false);
	});

	it("leaves a ledger that already finished the flow itself alone", () => {
		assert.equal(shouldSettleLegacyLedger("true", "true", null), false);
	});

	it("never re-fires once migrated, even if it would otherwise qualify", () => {
		assert.equal(shouldSettleLegacyLedger(null, "true", "true"), false);
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

		assert.equal(await getMeta(db, META_KEYS.onboardingComplete), "true");
		assert.equal(await getMeta(db, META_KEYS.onboardingGateMigrated), "true");
	});

	it("stamps the marker even when there is nothing to backfill", async () => {
		await settleLegacyOnboarding(db);

		assert.equal(await getMeta(db, META_KEYS.onboardingComplete), null);
		assert.equal(await getMeta(db, META_KEYS.onboardingGateMigrated), "true");
	});

	it("does not touch a ledger that already finished the flow itself", async () => {
		await finishOnboarding(db);

		await settleLegacyOnboarding(db);

		assert.equal(await getMeta(db, META_KEYS.onboardingComplete), "true");
		assert.equal(await getMeta(db, META_KEYS.onboardingGateMigrated), "true");
	});

	it("is idempotent — a second relaunch writes nothing further", async () => {
		await setMeta(db, META_KEYS.currencyChosen, "true");
		await settleLegacyOnboarding(db);

		await settleLegacyOnboarding(db);

		assert.equal(await getMeta(db, META_KEYS.onboardingComplete), "true");
		assert.equal(await getMeta(db, META_KEYS.onboardingGateMigrated), "true");
	});
});
