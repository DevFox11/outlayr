/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

vi.mock(import("@outlayr/env/backend"), () => ({ env: {} }));

const modules = import.meta.glob("./**/*.ts");

test("refuses to start a deletion it could not finish without REVENUECAT_SECRET_KEY", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedAuthUser(t);

    await expect(authenticatedAs(t, owner).mutation(api.accountDeletion.prepare, {})).rejects.toThrow(
        "REVENUECAT_SECRET_KEY"
    );
    await expect(t.run((ctx) => ctx.db.query("accountDeletionJobs").collect())).resolves.toStrictEqual([]);
});
