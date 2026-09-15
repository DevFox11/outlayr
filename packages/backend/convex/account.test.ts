/// <reference types="vite/client" />

import revenuecatTest from "convex-revenuecat/test";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { purgeUserBatch } from "./account";
import { photoKeyFor } from "./lib/photoKeys";
import schema from "./schema";
import { authenticatedAs, seedProUser } from "./test.helpers";

function harness() {
    const t = convexTest(schema, modules);
    revenuecatTest.register(t);
    return t;
}

const modules = import.meta.glob("./**/*.ts");

type TestClient = TestConvex<typeof schema>;
type PushRows = FunctionArgs<typeof api.sync.push>["rows"];

const DEVICE = "device-aaaa";

function transactionRow(localId: string): PushRows[number] {
    return {
        deletedAt: null,
        fields: {
            accountId: null,
            amount: 12.5,
            amountUsd: 12.5,
            categoryId: null,
            currency: "USD",
            customColor: null,
            date: 1_700_000_000_000,
            day: 1_700_000_000_000,
            details: null,
            emoji: null,
            exchangeRate: 1,
            exchangeRateType: "official",
            icon: null,
            imageColor: null,
            imageKey: null,
            income: false,
            month: 1_700_000_000_000,
            note: "coffee",
            onceRecurring: false,
            recurringCoefficient: 1,
            recurringEndDate: null,
            recurringType: 0,
        },
        localId,
        table: "transactions",
        updatedAt: 100,
    };
}

async function purgeAll(t: TestClient, userId: string): Promise<number> {
    let passes = 0;
    let done = false;
    while (!done) {
        // eslint-disable-next-line no-await-in-loop
        ({ done } = await t.run(async (ctx) => await purgeUserBatch(ctx, userId)));
        passes += 1;
        if (passes > 50) {
            throw new Error("purgeUserBatch never reported done");
        }
    }
    return passes;
}

async function countRows(t: TestClient, userId: string): Promise<number> {
    return await t.run(async (ctx) => {
        const rows = await ctx.db
            .query("transactions")
            .withIndex("by_user_and_seq", (q) => q.eq("userId", userId))
            .collect();
        return rows.length;
    });
}

describe("purging an account", () => {
    test("removes the caller's ledger and reports done", async () => {
        const t = harness();
        const owner = await seedProUser(t);
        await authenticatedAs(t, owner).mutation(api.sync.push, {
            deviceId: DEVICE,
            rows: [transactionRow("a"), transactionRow("b")],
        });
        await expect(countRows(t, owner.userId)).resolves.toBe(2);

        await purgeAll(t, owner.userId);

        await expect(countRows(t, owner.userId)).resolves.toBe(0);
    });

    test("leaves another account's ledger untouched", async () => {
        const t = harness();
        const owner = await seedProUser(t);
        const stranger = await seedProUser(t);
        await authenticatedAs(t, owner).mutation(api.sync.push, {
            deviceId: DEVICE,
            rows: [transactionRow("a")],
        });
        await authenticatedAs(t, stranger).mutation(api.sync.push, {
            deviceId: DEVICE,
            rows: [transactionRow("a")],
        });

        await purgeAll(t, owner.userId);

        await expect(countRows(t, owner.userId)).resolves.toBe(0);
        await expect(countRows(t, stranger.userId)).resolves.toBe(1);
    });

    test("drops the seq counter only once the rows are gone", async () => {
        // Removing it while rows remain would restart numbering under records that
        // already carry higher seqs, and a peer would then never see them again.
        const t = harness();
        const owner = await seedProUser(t);
        await authenticatedAs(t, owner).mutation(api.sync.push, {
            deviceId: DEVICE,
            rows: [transactionRow("a")],
        });

        const first = await t.run(async (ctx) => await purgeUserBatch(ctx, owner.userId));
        expect(first.done).toBeFalsy();
        const stateAfterFirst = await t.run(async (ctx) =>
            ctx.db
                .query("syncState")
                .withIndex("by_user", (q) => q.eq("userId", owner.userId))
                .unique()
        );
        expect(stateAfterFirst).not.toBeNull();

        await purgeAll(t, owner.userId);
        const stateAtEnd = await t.run(async (ctx) =>
            ctx.db
                .query("syncState")
                .withIndex("by_user", (q) => q.eq("userId", owner.userId))
                .unique()
        );
        expect(stateAtEnd).toBeNull();
    });

    test("frees the account's photos and forgets what they weighed", async () => {
        // Driven through a real confirmed upload rather than a hand-written row, so
        // the mapping, the accounting and the stored bytes all exist the way they
        // would in production. The Convex-storage path is the testable one: the R2
        // branch needs a component convex-test cannot register.
        const t = harness();
        const owner = await seedProUser(t);
        const key = photoKeyFor(owner.userId, "a.jpg");
        const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["bytes"])));
        await authenticatedAs(t, owner).action(api.photos.confirmUpload, {
            key,
            storageId,
        });

        await purgeAll(t, owner.userId);

        const leftovers = await t.run(async (ctx) => ({
            objects: await ctx.db.query("photoObjects").collect(),
            sizes: await ctx.db.query("photoSizes").collect(),
        }));
        expect(leftovers.sizes).toStrictEqual([]);
        expect(leftovers.objects).toStrictEqual([]);
    });

    test("is safe to run again on an account already purged", async () => {
        // A pass that dies halfway is retried rather than resumed, so a second run
        // over nothing has to be a no-op instead of an error.
        const t = harness();
        const owner = await seedProUser(t);

        const passes = await purgeAll(t, owner.userId);
        expect(passes).toBe(1);
        await expect(purgeAll(t, owner.userId)).resolves.toBe(1);
    });
});
