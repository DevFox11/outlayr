import { beforeEach, describe, expect, it } from "@jest/globals";
import { startOfDay } from "@outlayr/money/calendar";
import { RECURRING_TYPE } from "@outlayr/money/recurrence";
import { asc, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { accounts, categories, transactions } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { reminderNotices } from "@/domain/subscription-reminder-copy";

import { setMeta } from "./app-meta-core";
import { backfillRecurring, occurrenceId } from "./recurrence-backfill";
import { pendingReminderPlan, reminderCandidates } from "./subscription-reminders-core";

const NOW = new Date(2025, 5, 15, 10, 30);
const NINE_AM = { hour: 9, minute: 0 };
const at = (y: number, m: number, day: number, hour = 0, minute = 0): Date => new Date(y, m - 1, day, hour, minute);

type LandingRow = (string | number)[];

const byLocalId = (a: LandingRow, b: LandingRow): number => String(a[0]).localeCompare(String(b[0]));

const makeDb = () => migratedDatabase({ foreignKeys: false });

interface CarrierOverrides {
    accountId?: string | null;
    amount?: number;
    currency?: string | null;
    /** Its LAST charge, clock time included — the landing must not be read off it. */
    date: Date;
    day?: Date;
    deletedAt?: Date | null;
    id?: string;
    income?: boolean;
    note?: string;
    recurringAnchorDay?: number | null;
    recurringCoefficient?: number;
    recurringEndDate?: Date | null;
    recurringType?: number;
    reminderLeadDays?: number | null;
}

async function seedCarrier(db: Database, overrides: CarrierOverrides): Promise<string> {
    const id = overrides.id ?? "src";
    await db.insert(transactions).values({
        accountId: overrides.accountId ?? null,
        amount: overrides.amount ?? 9.99,
        categoryId: "bills",
        currency: overrides.currency === undefined ? "USD" : overrides.currency,
        date: overrides.date,
        day: overrides.day ?? startOfDay(overrides.date),
        deletedAt: overrides.deletedAt ?? null,
        details: null,
        id,
        income: overrides.income ?? false,
        month: startOfDay(overrides.date),
        note: overrides.note ?? "Netflix",
        onceRecurring: true,
        recurringAnchorDay: overrides.recurringAnchorDay ?? null,
        recurringCoefficient: overrides.recurringCoefficient ?? 1,
        recurringEndDate: overrides.recurringEndDate ?? null,
        recurringType: overrides.recurringType ?? RECURRING_TYPE.monthly,
        reminderLeadDays: overrides.reminderLeadDays ?? null,
        updatedAt: NOW,
    });
    return id;
}

function everyRow(db: Database) {
    return db.select().from(transactions).orderBy(asc(transactions.id));
}

describe("reminderCandidates", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("names the charge after today once today's notice has passed, never one already taken", async () => {
        await seedCarrier(db, {
            date: at(2025, 3, 15, 14, 30),
            reminderLeadDays: 2,
        });

        const candidates = await reminderCandidates(db, NOW, NINE_AM);

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.localId).toBe("src");
        expect(candidates[0]?.leadDays).toBe(2);
        expect(candidates[0]?.landing.getTime()).toBe(at(2025, 7, 15).getTime());
        expect((candidates[0]?.landing.getTime() ?? 0) > NOW.getTime()).toBeTruthy();
    });

    // Reading the landing off `date` would carry the last charge's clock time onto
    // every future one, so the announced day would drift by hours per hop.
    it("dates the landing from the ledger day, not the last charge's clock time", async () => {
        await seedCarrier(db, {
            date: at(2025, 3, 15, 23, 45),
            reminderLeadDays: 0,
        });

        const [candidate] = await reminderCandidates(db, NOW, NINE_AM);

        expect(candidate?.landing.getHours()).toBe(0);
        expect(candidate?.landing.getMinutes()).toBe(0);
        expect(candidate?.landing.getTime()).toBe(at(2025, 7, 15).getTime());
    });

    it("arms from the charge's own instant, not the zone the row was written in", async () => {
        await seedCarrier(db, {
            date: at(2025, 3, 15, 8, 0),
            day: at(2025, 3, 14, 12, 0),
            reminderLeadDays: 0,
        });

        const [candidate] = await reminderCandidates(db, NOW, NINE_AM);

        expect(candidate?.landing).toStrictEqual(at(2025, 7, 15));
    });

    it("advances from the day the chain was written for, not the short month it was clamped into", async () => {
        // 31 Jan monthly, clamped to 28 Feb by the backfill, which recorded the
        // anchor it was clamped from. March has a 31st, so the charge goes back.
        await seedCarrier(db, { date: at(2025, 2, 28), recurringAnchorDay: 31, reminderLeadDays: 0 });

        const [candidate] = await reminderCandidates(db, at(2025, 3, 5), NINE_AM);

        expect(candidate?.landing).toStrictEqual(at(2025, 3, 31));
    });

    it("keeps a future-dated pending charge as its own landing", async () => {
        await seedCarrier(db, {
            date: at(2025, 7, 15, 8, 0),
            reminderLeadDays: 3,
        });

        const [candidate] = await reminderCandidates(db, NOW, NINE_AM);

        expect(candidate?.landing.getTime()).toBe(at(2025, 7, 15).getTime());
        expect(candidate?.chargeId).toBe("src");
    });

    it("carries the copy a notice has to print", async () => {
        await seedCarrier(db, {
            amount: 11.99,
            currency: "EUR",
            date: at(2025, 3, 15),
            note: "Spotify",
            reminderLeadDays: 1,
        });

        const [candidate] = await reminderCandidates(db, NOW, NINE_AM);

        expect(candidate?.note).toBe("Spotify");
        expect(candidate?.amount).toBe(11.99);
        expect(candidate?.currency).toBe("EUR");
    });

    it("names the category and the live account, and reads a deleted account as none", async () => {
        await db.insert(categories).values({ id: "bills", income: true, name: "Salary", updatedAt: NOW });
        await db.insert(accounts).values([
            {
                currency: "USD",
                dateCreated: NOW,
                id: "live",
                initialBalanceDate: NOW,
                name: "Payoneer USD",
                updatedAt: NOW,
            },
            {
                currency: "USD",
                dateCreated: NOW,
                deletedAt: NOW,
                id: "gone",
                initialBalanceDate: NOW,
                name: "Old Visa",
                updatedAt: NOW,
            },
        ]);
        await seedCarrier(db, { accountId: "live", date: at(2025, 3, 15), id: "a", income: true, reminderLeadDays: 1 });
        await seedCarrier(db, { accountId: "gone", date: at(2025, 3, 15), id: "b", reminderLeadDays: 1 });

        const candidates = await reminderCandidates(db, NOW, NINE_AM);

        expect(
            candidates
                .map(({ account, category, income, localId }) => ({ account, category, income, localId }))
                .sort((x, y) => x.localId.localeCompare(y.localId))
        ).toStrictEqual([
            { account: "Payoneer USD", category: "Salary", income: true, localId: "a" },
            { account: null, category: "Salary", income: false, localId: "b" },
        ]);
    });

    it("stamps a row that stored no currency with the ledger's", async () => {
        await setMeta(db, "currency", "MXN");
        await seedCarrier(db, {
            currency: null,
            date: at(2025, 3, 15),
            reminderLeadDays: 1,
        });

        const [candidate] = await reminderCandidates(db, NOW, NINE_AM);

        expect(candidate?.currency).toBe("MXN");
    });

    it("falls back to the app default when the ledger names no currency", async () => {
        await seedCarrier(db, {
            currency: null,
            date: at(2025, 3, 15),
            reminderLeadDays: 1,
        });

        const [candidate] = await reminderCandidates(db, NOW, NINE_AM);

        expect(candidate?.currency).toBe("USD");
    });

    it("yields nothing for a carrier with no notice set", async () => {
        await seedCarrier(db, { date: at(2025, 3, 15), reminderLeadDays: null });

        await expect(reminderCandidates(db, NOW, NINE_AM)).resolves.toStrictEqual([]);
    });

    it("keeps a same-day notice, which is not the off state", async () => {
        await seedCarrier(db, { date: at(2025, 3, 15), reminderLeadDays: 0 });

        const candidates = await reminderCandidates(db, NOW, NINE_AM);

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.leadDays).toBe(0);
    });

    it("yields nothing for a soft-deleted carrier", async () => {
        await seedCarrier(db, {
            date: at(2025, 3, 15),
            deletedAt: NOW,
            reminderLeadDays: 2,
        });

        await expect(reminderCandidates(db, NOW, NINE_AM)).resolves.toStrictEqual([]);
    });

    // Every retire path clears the column, but a peer's hand-off replicates in
    // whatever it wrote — so the notice alone can never be the predicate.
    it("yields nothing for a retired row still holding a notice", async () => {
        await seedCarrier(db, {
            date: at(2025, 3, 15),
            recurringType: RECURRING_TYPE.none,
            reminderLeadDays: 2,
        });

        await expect(reminderCandidates(db, NOW, NINE_AM)).resolves.toStrictEqual([]);
    });

    it("yields nothing once the chain has run past its end date", async () => {
        await seedCarrier(db, {
            date: at(2025, 6, 10),
            recurringEndDate: at(2025, 6, 16),
            recurringType: RECURRING_TYPE.weekly,
            reminderLeadDays: 1,
        });

        await expect(reminderCandidates(db, NOW, NINE_AM)).resolves.toStrictEqual([]);
    });

    it("resolves every live carrier, each on its own cadence", async () => {
        await seedCarrier(db, {
            date: at(2025, 3, 15),
            id: "netflix",
            reminderLeadDays: 2,
        });
        await seedCarrier(db, {
            date: at(2025, 6, 10),
            id: "gym",
            recurringType: RECURRING_TYPE.weekly,
            reminderLeadDays: 1,
        });

        const candidates = await reminderCandidates(db, NOW, NINE_AM);

        expect(
            candidates.map((candidate) => [candidate.localId, candidate.landing.getTime()]).sort(byLocalId)
        ).toStrictEqual(
            [
                ["gym", at(2025, 6, 17).getTime()],
                ["netflix", at(2025, 7, 15).getTime()],
            ].sort(byLocalId)
        );
    });
});

describe("pendingReminderPlan", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("arms the notice the lead and the time ask for", async () => {
        await seedCarrier(db, {
            date: at(2025, 3, 15, 14, 30),
            reminderLeadDays: 2,
        });

        const arm = await pendingReminderPlan(db, NOW, NINE_AM);

        expect(arm).toHaveLength(1);
        expect(arm[0]?.id).toBe("outlayr.sub-due.src");
        expect(arm[0]?.localId).toBe("src");
        expect(arm[0]?.fireAt.getTime()).toBe(at(2025, 7, 13, 9, 0).getTime());
    });

    it("drops a notice whose fire time has already passed", async () => {
        await seedCarrier(db, {
            date: at(2025, 6, 10),
            recurringType: RECURRING_TYPE.weekly,
            reminderLeadDays: 7,
        });

        await expect(pendingReminderPlan(db, NOW, NINE_AM)).resolves.toStrictEqual([]);
    });

    it("keeps the soonest notices when the cap truncates", async () => {
        await seedCarrier(db, {
            date: at(2025, 3, 15),
            id: "netflix",
            reminderLeadDays: 2,
        });
        await seedCarrier(db, {
            date: at(2025, 6, 10),
            id: "gym",
            recurringType: RECURRING_TYPE.weekly,
            reminderLeadDays: 1,
        });

        const arm = await pendingReminderPlan(db, NOW, NINE_AM, 1);

        expect(arm.map((armed) => armed.localId)).toStrictEqual(["gym"]);
    });

    it("writes nothing", async () => {
        await seedCarrier(db, { date: at(2025, 3, 15), reminderLeadDays: 2 });
        const before = await everyRow(db);

        await pendingReminderPlan(db, NOW, NINE_AM);

        await expect(everyRow(db)).resolves.toStrictEqual(before);
    });

    // The plan is what the scheduler hands to iOS, so a request that reached it
    // without its copy would announce a bare identifier.
    it("carries the copy and the landing each notice has to print", async () => {
        await seedCarrier(db, {
            amount: 11.99,
            currency: "EUR",
            date: at(2025, 3, 15),
            note: "Spotify",
            reminderLeadDays: 2,
        });

        const [reminder] = await pendingReminderPlan(db, NOW, NINE_AM);

        expect(reminder?.note).toBe("Spotify");
        expect(reminder?.amount).toBe(11.99);
        expect(reminder?.currency).toBe("EUR");
        expect(reminder?.landing.getTime()).toBe(at(2025, 7, 15).getTime());
    });

    it("names the very row the backfill writes once the charge lands, evening clock time included", async () => {
        await seedCarrier(db, { date: at(2025, 6, 15, 21, 30), reminderLeadDays: 0 });

        const [reminder] = await pendingReminderPlan(db, NOW, NINE_AM);
        await backfillRecurring(db, "src", at(2025, 7, 15, 9, 0));

        const [charge] = await db
            .select({ date: transactions.date })
            .from(transactions)
            .where(eq(transactions.id, reminder?.chargeId ?? ""));
        expect(charge?.date).toStrictEqual(at(2025, 7, 15, 21, 30));
    });

    it("arms an on-the-day notice through its morning, before the sweep moves the carrier and after", async () => {
        await seedCarrier(db, { date: at(2025, 5, 15, 21, 30), reminderLeadDays: 0 });
        const morning = at(2025, 6, 15, 7, 0);

        const [before] = await pendingReminderPlan(db, morning, NINE_AM);
        await backfillRecurring(db, "src", morning);
        const [after] = await pendingReminderPlan(db, morning, NINE_AM);

        expect(before?.fireAt).toStrictEqual(at(2025, 6, 15, 9, 0));
        expect(before?.chargeId).toBe(occurrenceId("src", at(2025, 6, 15, 21, 30)));
        expect(after?.fireAt).toStrictEqual(at(2025, 6, 15, 9, 0));
        expect(after?.localId).toBe(before?.chargeId);
        expect(after?.chargeId).toBe(after?.localId);
    });

    it("arms the next cycle once the on-the-day notice has fired", async () => {
        await seedCarrier(db, { date: at(2025, 5, 15, 21, 30), reminderLeadDays: 0 });
        const late = at(2025, 6, 15, 10, 0);

        const [before] = await pendingReminderPlan(db, late, NINE_AM);
        await backfillRecurring(db, "src", late);
        const [after] = await pendingReminderPlan(db, late, NINE_AM);

        expect(before?.fireAt).toStrictEqual(at(2025, 7, 15, 9, 0));
        expect(after?.fireAt).toStrictEqual(at(2025, 7, 15, 9, 0));
        expect(after?.chargeId).toBe(occurrenceId(after?.localId ?? "", at(2025, 7, 15, 21, 30)));
    });

    it("folds two charges due this morning into one digest", async () => {
        await seedCarrier(db, { date: at(2025, 5, 15), id: "netflix", reminderLeadDays: 0 });
        await seedCarrier(db, { date: at(2025, 5, 15), id: "gym", note: "Gym", reminderLeadDays: 0 });

        const plan = await pendingReminderPlan(db, at(2025, 6, 15, 7, 0), NINE_AM);

        expect(reminderNotices(plan, "en")).toStrictEqual([
            expect.objectContaining({ fireAt: at(2025, 6, 15, 9, 0), title: "2 charges today" }),
        ]);
    });

    it("resolves a row with no currency of its own against the ledger's", async () => {
        await setMeta(db, "currency", "MXN");
        await seedCarrier(db, {
            currency: null,
            date: at(2025, 3, 15),
            reminderLeadDays: 2,
        });

        const [reminder] = await pendingReminderPlan(db, NOW, NINE_AM);

        expect(reminder?.currency).toBe("MXN");
    });

    // Two carriers, one truncated away: the surviving request has to keep ITS own
    // copy, not the row the plan dropped.
    it("keeps each notice's copy with its own request under the cap", async () => {
        await seedCarrier(db, {
            amount: 9.99,
            date: at(2025, 3, 15),
            id: "netflix",
            note: "Netflix",
            reminderLeadDays: 2,
        });
        await seedCarrier(db, {
            amount: 40,
            date: at(2025, 6, 10),
            id: "gym",
            note: "Gym",
            recurringType: RECURRING_TYPE.weekly,
            reminderLeadDays: 1,
        });

        const arm = await pendingReminderPlan(db, NOW, NINE_AM, 1);

        expect(arm).toHaveLength(1);
        expect(arm[0]?.localId).toBe("gym");
        expect(arm[0]?.note).toBe("Gym");
        expect(arm[0]?.amount).toBe(40);
    });
});
