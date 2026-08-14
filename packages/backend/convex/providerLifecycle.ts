import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { decryptOAuthToken, setTokenUtil } from "better-auth/oauth2";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

export interface AppleGrantInput {
    authorizationCode: string;
    identityToken: string;
    nonce: string;
    providerSubject: string;
}

interface AppleTokens {
    accessToken: string;
    expiresIn: number;
    idToken: string;
    refreshToken?: string;
}

interface AppleStoredTokens extends Pick<AppleTokens, "accessToken" | "refreshToken"> {
    accessTokenExpiresAt: Date;
}

interface AppleAccount {
    accessToken?: string | null;
    accessTokenExpiresAt?: Date | string | null;
    accountId: string;
    id: string;
    refreshToken?: string | null;
    updatedAt?: Date | string | null;
}

export interface AppleGrantDependencies {
    exchange: (authorizationCode: string) => Promise<AppleTokens>;
    findAppleAccount: (userId: string) => Promise<AppleAccount | null>;
    persist: (accountId: string, tokens: AppleStoredTokens, retainedRefreshToken?: string | null) => Promise<void>;
    refresh: (account: AppleAccount) => Promise<AppleTokens>;
    revoke: (refreshToken: string) => Promise<void>;
    verify: (idToken: string, nonce?: string) => Promise<{ subject: string }>;
}

function expiresAt(tokens: AppleTokens, now = new Date()): Date {
    return new Date(now.getTime() + tokens.expiresIn * 1000);
}

async function revokeReplacement(tokens: AppleTokens | null, deps: AppleGrantDependencies): Promise<void> {
    if (tokens?.refreshToken) {
        await deps.revoke(tokens.refreshToken).catch(() => undefined);
    }
}

export async function grantAppleCredential(
    userId: string,
    input: AppleGrantInput,
    deps: AppleGrantDependencies
): Promise<{ active: true }> {
    const identity = await deps.verify(input.identityToken, input.nonce);
    if (identity.subject !== input.providerSubject) {
        throw new Error("Apple identity subject does not match the submitted provider subject");
    }

    const account = await deps.findAppleAccount(userId);
    if (!account || account.accountId !== input.providerSubject) {
        throw new Error("Apple identity subject does not match the linked Apple account");
    }

    let tokens: AppleTokens | null = null;
    try {
        tokens = await deps.exchange(input.authorizationCode);
        const exchanged = await deps.verify(tokens.idToken);
        if (exchanged.subject !== input.providerSubject) {
            throw new Error("Apple exchanged token subject does not match the linked Apple account");
        }
        await deps.persist(account.id, {
            accessToken: tokens.accessToken,
            accessTokenExpiresAt: expiresAt(tokens),
            refreshToken: tokens.refreshToken,
        });
        return { active: true };
    } catch (cause) {
        await revokeReplacement(tokens, deps);
        throw cause;
    }
}

const APPLE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function refreshedWithinDailyCadence(account: AppleAccount, now: Date): boolean {
    if (!account.updatedAt) {
        return false;
    }
    return new Date(account.updatedAt).getTime() + APPLE_REFRESH_INTERVAL_MS > now.getTime();
}

export async function refreshAppleCredential(
    userId: string,
    deps: AppleGrantDependencies,
    now = new Date()
): Promise<{ active: true; refreshed: boolean }> {
    const account = await deps.findAppleAccount(userId);
    if (!account?.refreshToken) {
        throw new Error("Linked Apple account does not have refresh material");
    }
    if (refreshedWithinDailyCadence(account, now)) {
        return { active: true, refreshed: false };
    }

    let tokens: AppleTokens | null = null;
    try {
        tokens = await deps.refresh(account);
        const identity = await deps.verify(tokens.idToken);
        if (identity.subject !== account.accountId) {
            throw new Error("Apple refreshed token subject does not match the linked Apple account");
        }
        await deps.persist(
            account.id,
            {
                accessToken: tokens.accessToken,
                accessTokenExpiresAt: expiresAt(tokens, now),
                refreshToken: tokens.refreshToken,
            },
            account.refreshToken
        );
        return { active: true, refreshed: true };
    } catch (cause) {
        await revokeReplacement(tokens, deps);
        throw cause;
    }
}

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

function sha256Hex(value: string): Promise<string> {
    return crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(value))
        .then((bytes) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

export function appleTokenVerifier(clientId: string): AppleGrantDependencies["verify"] {
    return async (idToken, rawNonce) => {
        const { payload } = await jwtVerify(idToken, APPLE_JWKS, { audience: clientId, issuer: APPLE_ISSUER });
        if (typeof payload.sub !== "string") {
            throw new TypeError("Apple identity token does not contain a subject");
        }
        if (rawNonce && payload.nonce !== (await sha256Hex(rawNonce))) {
            throw new Error("Apple identity token nonce does not match the raw nonce");
        }
        return { subject: payload.sub };
    };
}

interface AppleServerConfig {
    clientId: string;
    clientSecret: () => Promise<string>;
}

interface AppleResumeValidator {
    resumeUserId: (resumeSecret: string) => Promise<string>;
}

interface AppleLifecycleContext {
    internalAdapter: {
        findAccounts: (userId: string) => Promise<(AppleAccount & { providerId: string })[]>;
        updateAccount: (accountId: string, values: Record<string, unknown>) => Promise<unknown>;
    };
}

async function appleTokenRequest(config: AppleServerConfig, parameters: Record<string, string>): Promise<AppleTokens> {
    const response = await fetch("https://appleid.apple.com/auth/token", {
        body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: await config.clientSecret(),
            ...parameters,
        }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
    });
    if (!response.ok) {
        throw new Error("Apple token exchange failed");
    }
    const body: unknown = await response.json();
    if (
        typeof body !== "object" ||
        body === null ||
        typeof (body as Record<string, unknown>).access_token !== "string" ||
        typeof (body as Record<string, unknown>).expires_in !== "number" ||
        typeof (body as Record<string, unknown>).id_token !== "string"
    ) {
        throw new Error("Apple token exchange returned incomplete token material");
    }
    const tokens = body as Record<string, unknown>;
    return {
        accessToken: tokens.access_token as string,
        expiresIn: tokens.expires_in as number,
        idToken: tokens.id_token as string,
        refreshToken: typeof tokens.refresh_token === "string" ? tokens.refresh_token : undefined,
    };
}

function appleCredentialLifecycleDependencies(config: AppleServerConfig, context: AppleLifecycleContext) {
    return {
        exchange: async (authorizationCode: string): Promise<AppleTokens> => {
            const tokens = await appleTokenRequest(config, {
                code: authorizationCode,
                grant_type: "authorization_code",
            });
            if (!tokens.refreshToken) {
                throw new Error("Apple authorization-code exchange returned no refresh token");
            }
            return tokens;
        },
        findAppleAccount: async (userId: string) => {
            const accounts = await context.internalAdapter.findAccounts(userId);
            return accounts.find((a: AppleAccount & { providerId: string }) => a.providerId === "apple") ?? null;
        },
        persist: async (accountId, tokens, retainedRefreshToken) => {
            await context.internalAdapter.updateAccount(accountId, {
                accessToken: await setTokenUtil(tokens.accessToken, context as never),
                accessTokenExpiresAt: tokens.accessTokenExpiresAt,
                refreshToken: tokens.refreshToken
                    ? await setTokenUtil(tokens.refreshToken, context as never)
                    : retainedRefreshToken,
            });
        },
        refresh: async (account: AppleAccount): Promise<AppleTokens> => {
            if (!account.refreshToken) {
                throw new Error("Linked Apple account does not have refresh material");
            }
            return appleTokenRequest(config, {
                grant_type: "refresh_token",
                refresh_token: await decryptOAuthToken(account.refreshToken, context as never),
            });
        },
        revoke: async (refreshToken: string) => {
            const response = await fetch("https://appleid.apple.com/auth/revoke", {
                body: new URLSearchParams({
                    client_id: config.clientId,
                    client_secret: await config.clientSecret(),
                    token: refreshToken,
                    token_type_hint: "refresh_token",
                }),
                headers: { "content-type": "application/x-www-form-urlencoded" },
                method: "POST",
            });
            if (!response.ok) {
                throw new Error("Apple token cleanup failed");
            }
        },
        verify: appleTokenVerifier(config.clientId),
    } satisfies AppleGrantDependencies;
}

export function appleCredentialLifecycle(config: AppleServerConfig | null, resumeValidator: AppleResumeValidator) {
    return {
        endpoints: {
            grantAppleCredential: createAuthEndpoint(
                "/apple/grant",
                {
                    body: z.object({
                        authorizationCode: z.string().min(1),
                        identityToken: z.string().min(1),
                        nonce: z.string().min(1),
                        providerSubject: z.string().min(1),
                    }),
                    method: "POST",
                    use: [sessionMiddleware],
                },
                async (ctx) => {
                    if (config === null) {
                        throw new Error("Apple credential lifecycle is not configured");
                    }
                    const result = await grantAppleCredential(
                        ctx.context.session.user.id,
                        ctx.body,
                        appleCredentialLifecycleDependencies(config, ctx.context as AppleLifecycleContext)
                    );
                    return ctx.json(result);
                }
            ),
            refreshAppleCredential: createAuthEndpoint(
                "/apple/refresh",
                {
                    body: z.object({}),
                    method: "POST",
                    use: [sessionMiddleware],
                },
                async (ctx) => {
                    if (config === null) {
                        throw new Error("Apple credential lifecycle is not configured");
                    }
                    return ctx.json(
                        await refreshAppleCredential(
                            ctx.context.session.user.id,
                            appleCredentialLifecycleDependencies(config, ctx.context as AppleLifecycleContext)
                        )
                    );
                }
            ),
            revokeAppleCredential: createAuthEndpoint(
                "/apple/revoke",
                {
                    body: z.object({ resumeSecret: z.string().min(1) }),
                    method: "POST",
                },
                async (ctx) => {
                    if (config === null) {
                        throw new Error("Apple account deletion is not configured");
                    }
                    const dependencies = appleCredentialLifecycleDependencies(
                        config,
                        ctx.context as AppleLifecycleContext
                    );
                    const account = await dependencies.findAppleAccount(
                        await resumeValidator.resumeUserId(ctx.body.resumeSecret)
                    );
                    const encryptedToken = account?.refreshToken ?? account?.accessToken;
                    if (!(account && encryptedToken)) {
                        throw new Error("Apple provider revocation requires reauthentication");
                    }
                    await dependencies.revoke(await decryptOAuthToken(encryptedToken, ctx.context as never));
                    return ctx.json({ revoked: true });
                }
            ),
        },
        id: "apple-credential-lifecycle",
    };
}
