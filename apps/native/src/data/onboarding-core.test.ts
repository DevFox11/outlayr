import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { completeOnboarding, isOnboardingSettled } from "./onboarding-core";

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
		assert.equal(isOnboardingSettled(null, null), false);
	});

	it("holds back a run that was killed before the final write", () => {
		// Nothing is written until the last step, so an interrupted flow is
		// indistinguishable from one never started — and re-running it is safe.
		assert.equal(isOnboardingSettled(null, null), false);
	});

	it("lets a finished run through", () => {
		assert.equal(isOnboardingSettled("true", "true"), true);
	});

	it("lets a ledger that stated its currency before this flow existed through", () => {
		assert.equal(isOnboardingSettled(null, "true"), true);
	});

	it("survives the marker alone, so the flow is never re-shown", () => {
		assert.equal(isOnboardingSettled("true", null), true);
	});

	it("treats anything but an affirmative as unanswered", () => {
		assert.equal(isOnboardingSettled("false", "false"), false);
		assert.equal(isOnboardingSettled("", ""), false);
		assert.equal(isOnboardingSettled("TRUE", "1"), false);
	});
});

describe("completeOnboarding", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("states the currency even when the user accepts the default", async () => {
		await setMeta(db, META_KEYS.currency, DEFAULT_CURRENCY);

		await completeOnboarding(db, DEFAULT_CURRENCY);

		assert.equal(await getMeta(db, META_KEYS.currency), DEFAULT_CURRENCY);
		// Without this the ledger stays indistinguishable from one nobody chose,
		// and `stampLedgerCurrency` declines it forever.
		assert.equal(await getMeta(db, META_KEYS.currencyChosen), "true");
		assert.equal(await getMeta(db, META_KEYS.onboardingComplete), "true");
	});

	it("records a currency the user changed to", async () => {
		await setMeta(db, META_KEYS.currency, DEFAULT_CURRENCY);

		await completeOnboarding(db, "EUR");

		assert.equal(await getMeta(db, META_KEYS.currency), "EUR");
		assert.equal(await getMeta(db, META_KEYS.currencyChosen), "true");
	});

	it("settles the gate it writes", async () => {
		await completeOnboarding(db, "JPY");

		assert.equal(
			isOnboardingSettled(
				await getMeta(db, META_KEYS.onboardingComplete),
				await getMeta(db, META_KEYS.currencyChosen),
			),
			true,
		);
	});

	it("is idempotent, so a re-run after an interrupted one just restates", async () => {
		await completeOnboarding(db, "GBP");
		await completeOnboarding(db, "CHF");

		assert.equal(await getMeta(db, META_KEYS.currency), "CHF");
		assert.equal(await getMeta(db, META_KEYS.onboardingComplete), "true");
	});
});
