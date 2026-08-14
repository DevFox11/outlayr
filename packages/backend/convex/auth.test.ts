/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { createAuth } from "./auth";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

const baseUrlWith = async (vars: Record<string, string>) => {
    for (const [name, value] of Object.entries(vars)) {
        vi.stubEnv(name, value);
    }
    const t = convexTest(schema, modules);
    return await t.run(async (ctx) => createAuth(ctx).options.baseURL);
};

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("auth base url", () => {
    // `CONVEX_SITE_URL` is a built-in Convex system variable, always present in a
    // deployed function. `SITE_URL` only exists once there is a web client, so
    // falling back to it is what keeps a native-only deployment from minting
    // OAuth redirects against localhost.
    test("falls back to the deployment site url when SITE_URL is unset", async () => {
        const baseURL = await baseUrlWith({
            CONVEX_SITE_URL: "https://example-deployment.convex.site",
            SITE_URL: "",
        });

        expect(baseURL).toBe("https://example-deployment.convex.site");
    });

    test("prefers an explicit SITE_URL over the deployment site url", async () => {
        const baseURL = await baseUrlWith({
            CONVEX_SITE_URL: "https://example-deployment.convex.site",
            SITE_URL: "https://app.tryoutlayr.com",
        });

        expect(baseURL).toBe("https://app.tryoutlayr.com");
    });
});

describe("auth", () => {
    // No Apple or Google credential is set in the test env, which is also the
    // state of a freshly provisioned deployment. Construction must still succeed
    // or the whole backend fails to boot over an unconfigured provider.
    //
    // The instance cannot cross the `t.run` boundary — it carries a `$ERROR_CODES`
    // field and Convex reserves the `$` prefix — so assert on a scalar.
    test("builds without any social provider credentials", async () => {
        const t = convexTest(schema, modules);

        const handlerType = await t.run(async (ctx) => typeof createAuth(ctx).handler);

        expect(handlerType).toBe("function");
    });

    test("disables Better Auth public deletion while the resumable job owns deletion", async () => {
        const t = convexTest(schema, modules);

        const enabled = await t.run(async (ctx) => createAuth(ctx).options.user?.deleteUser?.enabled);

        expect(enabled).toBeFalsy();
    });

    test("getCurrentUser is null when signed out", async () => {
        const t = convexTest(schema, modules);

        await expect(t.query(api.auth.getCurrentUser, {})).resolves.toBeNull();
    });

    test("getCurrentUser resolves the signed-in user", async () => {
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t, { email: "signed-in@example.com" });

        const user = await authenticatedAs(t, identity).query(api.auth.getCurrentUser, {});

        expect(user).toMatchObject({
            _id: identity.userId,
            email: "signed-in@example.com",
        });
    });
});
