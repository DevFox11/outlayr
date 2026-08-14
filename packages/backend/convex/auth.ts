import { expo } from "@better-auth/expo";
import { createClient } from "@convex-dev/better-auth";
import type { GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { env } from "@outlayr/env/backend";
import { betterAuth } from "better-auth/minimal";
import { importPKCS8, SignJWT } from "jose";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { appleCredentialLifecycle } from "./providerLifecycle";

/**
 * `CONVEX_SITE_URL` is a built-in Convex system variable — always populated in a
 * deployed function, with no configuration. It is the correct auth origin for a
 * native-only app, which is what this repo is: `SITE_URL` only becomes
 * meaningful once a web client exists, so it takes precedence when set but
 * cannot be required.
 *
 * Resolved per call rather than at module scope so a deployment that sets these
 * after first load still picks them up.
 */
function resolveSiteUrl() {
    return process.env.SITE_URL || process.env.CONVEX_SITE_URL || "http://localhost:3000";
}

const nativeAppUrl = process.env.NATIVE_APP_URL || "outlayr://";

export const authComponent = createClient<DataModel>(components.betterAuth);

const appleConfig = (() => {
    const clientId = env.APPLE_CLIENT_ID;
    const teamId = env.APPLE_TEAM_ID;
    const keyId = env.APPLE_KEY_ID;
    const privateKey = env.APPLE_PRIVATE_KEY;

    if (clientId && teamId && keyId && privateKey) {
        return { clientId, keyId, privateKey, teamId };
    }

    return null;
})();

const googleConfig = (() => {
    const clientIdWeb = env.GOOGLE_CLIENT_ID_WEB;
    const clientIdIos = env.GOOGLE_CLIENT_ID_IOS;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (clientIdWeb && clientIdIos && clientSecret) {
        return { clientId: [clientIdWeb, clientIdIos], clientSecret };
    }

    return null;
})();

/**
 * Apple has no static client secret: it is an ES256 JWT signed with the team's
 * private key, valid for at most six months, so it must be minted per request
 * rather than stored as an env var.
 */
async function generateAppleClientSecret(clientId: string, teamId: string, keyId: string, privateKey: string) {
    const key = await importPKCS8(privateKey, "ES256");
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: keyId })
        .setIssuer(teamId)
        .setSubject(clientId)
        .setAudience("https://appleid.apple.com")
        .setIssuedAt(now)
        .setExpirationTime(now + 180 * 24 * 60 * 60)
        .sign(key);
}

function createAuth(ctx: GenericCtx<DataModel>) {
    const siteUrl = resolveSiteUrl();

    return betterAuth({
        account: { encryptOAuthTokens: true },
        baseURL: siteUrl,
        database: authComponent.adapter(ctx),
        emailAndPassword: {
            enabled: false,
        },
        plugins: [
            appleCredentialLifecycle(
                appleConfig
                    ? {
                          clientId: appleConfig.clientId,
                          clientSecret: () =>
                              generateAppleClientSecret(
                                  appleConfig.clientId,
                                  appleConfig.teamId,
                                  appleConfig.keyId,
                                  appleConfig.privateKey
                              ),
                      }
                    : null,
                {
                    resumeUserId: async (resumeSecret) => {
                        if (!("runQuery" in ctx)) {
                            throw new Error("Apple credential revocation needs a query context");
                        }
                        return await ctx.runQuery(internal.accountDeletion.resumeUserId, { resumeSecret });
                    },
                }
            ),
            expo(),
            crossDomain({ siteUrl }),
            convex({
                authConfig,
                jwksRotateOnTokenGenerationError: true,
            }),
        ],
        socialProviders: {
            apple: async () => {
                if (!appleConfig) {
                    return {
                        appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER ?? "",
                        clientId: "",
                        clientSecret: "",
                        enabled: false,
                    };
                }

                return {
                    appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER ?? "",
                    clientId: appleConfig.clientId,
                    clientSecret: await generateAppleClientSecret(
                        appleConfig.clientId,
                        appleConfig.teamId,
                        appleConfig.keyId,
                        appleConfig.privateKey
                    ),
                    enabled: false,
                };
            },
            google: googleConfig
                ? {
                      clientId: googleConfig.clientId,
                      clientSecret: googleConfig.clientSecret,
                  }
                : {
                      clientId: [],
                      clientSecret: "",
                  },
        },
        trustedOrigins: [siteUrl, nativeAppUrl, "exp://", "https://appleid.apple.com"],
        user: {
            deleteUser: {
                enabled: false,
            },
        },
    });
}

export { createAuth };

export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => await authComponent.safeGetAuthUser(ctx),
});
