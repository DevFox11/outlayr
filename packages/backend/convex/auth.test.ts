/// <reference types="vite/client" />

import { apple as appleProvider } from "better-auth/social-providers";
import { convexTest } from "convex-test";
import { decodeJwt, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createAuth } from "./auth";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/** A throwaway P-256 key, only so `generateAppleClientSecret` has something to sign with. */
const APPLE_TEST_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgXkjMeO1+ck8HgMHC
ipgW4DI3YYzFM8Yv1eUf0Bv2ID6hRANCAASSDa0TEa2kqSLgNw30wzl0sObor81R
Hz8YSjsV6hhmjjG3X5hJep3DQh4aSLJLnzqlGwbmhKpI+3vuaqtsaErm
-----END PRIVATE KEY-----`;

const baseUrlWith = async (vars: Record<string, string>) => {
    for (const [name, value] of Object.entries(vars)) {
        vi.stubEnv(name, value);
    }
    const t = convexTest(schema, modules);
    return await t.run(async (ctx) => createAuth(ctx).options.baseURL);
};

const resolveApple = async (vars: Record<string, string>) => {
    vi.stubEnv("APPLE_CLIENT_ID", "com.tryoutlayr.app");
    vi.stubEnv("APPLE_TEAM_ID", "TEAM123456");
    vi.stubEnv("APPLE_KEY_ID", "KEY1234567");
    vi.stubEnv("APPLE_PRIVATE_KEY", APPLE_TEST_KEY);
    for (const [name, value] of Object.entries(vars)) {
        vi.stubEnv(name, value);
    }
    vi.resetModules();
    const { createAuth: build } = await import("./auth");
    const t = convexTest(schema, modules);
    const apple = await t.run(async (ctx) => {
        const factory = build(ctx).options.socialProviders?.apple;
        return typeof factory === "function" ? await factory() : factory;
    });
    if (!apple) {
        throw new Error("Apple provider is missing");
    }
    return apple;
};

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe("auth base url", () => {
    // `CONVEX_SITE_URL` is a built-in Convex system variable, always present in a
    // deployed function. `SITE_URL` only exists once there is a web client, so
    // falling back to it is what keeps a native-only deployment from minting
    // OAuth redirects against localhost.
    it("falls back to the deployment site url when SITE_URL is unset", async () => {
        const baseURL = await baseUrlWith({
            CONVEX_SITE_URL: "https://example-deployment.convex.site",
            SITE_URL: "",
        });

        expect(baseURL).toBe("https://example-deployment.convex.site");
    });

    it("prefers an explicit SITE_URL over the deployment site url", async () => {
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
    it("builds without any social provider credentials", async () => {
        const t = convexTest(schema, modules);

        const handlerType = await t.run(async (ctx) => typeof createAuth(ctx).handler);

        expect(handlerType).toBe("function");
    });

    // The APPLE_* variables are read at module scope, so the module has to be
    // re-imported after they are stubbed.
    it("enables the Apple provider once its credentials are configured", async () => {
        const apple = await resolveApple({});

        // Better Auth drops a provider whole on `enabled: false`, so this being
        // false is not "configured but off" — it is the Apple button answering
        // PROVIDER_NOT_FOUND on every tap.
        expect(apple.enabled).toBeTruthy();
        expect(apple.clientId).toBe("com.tryoutlayr.app");
    });

    it("signs in on the web with the Services ID and keeps verifying native id tokens against the bundle id", async () => {
        const apple = await resolveApple({ APPLE_WEB_CLIENT_ID: "com.danestves.outlayr.si" });
        const { privateKey, publicKey } = await generateKeyPair("ES256");
        const jwk = { ...(await exportJWK(publicKey)), alg: "ES256", kid: "apple-test" };
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ keys: [jwk] }))
        );
        const nativeIdToken = await new SignJWT({ nonce: "native-nonce" })
            .setProtectedHeader({ alg: "ES256", kid: "apple-test" })
            .setIssuer("https://appleid.apple.com")
            .setAudience("com.tryoutlayr.app")
            .setSubject("001234.apple-subject")
            .setIssuedAt()
            .sign(privateKey);

        expect(apple.clientId).toBe("com.danestves.outlayr.si");
        expect(decodeJwt(apple.clientSecret).sub).toBe("com.danestves.outlayr.si");
        await expect(appleProvider(apple).verifyIdToken(nativeIdToken, "native-nonce")).resolves.toBeTruthy();
    });

    it("disables Better Auth public deletion while the resumable job owns deletion", async () => {
        const t = convexTest(schema, modules);

        const enabled = await t.run(async (ctx) => createAuth(ctx).options.user?.deleteUser?.enabled);

        expect(enabled).toBeFalsy();
    });
});
