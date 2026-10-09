/// <reference types="vite/client" />

import { register } from "convex-mcp-gateway/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const ORIGIN = "https://edge.tryoutlayr.com";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("MCP discovery metadata", () => {
    it("adds scopes to the gateway's protected resource metadata without moving the resource", async () => {
        const t = convexTest(schema, modules);
        register(t);
        await t.mutation(internal.mcp.configureOAuth, { authServerUrl: ORIGIN });

        const response = await t.fetch("/.well-known/oauth-protected-resource/mcp");

        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        await expect(response.json()).resolves.toMatchObject({
            authorization_servers: [ORIGIN],
            bearer_methods_supported: ["header"],
            resource: expect.stringMatching(/\/mcp\/$/u),
            resource_documentation: "https://tryoutlayr.com/auth.md",
            scopes_supported: ["offline_access"],
        });
    });

    it("publishes the site origin even when the proxy hands Convex plain http", async () => {
        vi.stubEnv("CONVEX_SITE_URL", ORIGIN);
        const t = convexTest(schema, modules);
        register(t);
        await t.mutation(internal.mcp.configureOAuth, { authServerUrl: ORIGIN });

        const metadata = await t.fetch("/.well-known/oauth-protected-resource/mcp");
        const challenge = await t.fetch("/mcp", {
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "initialize",
                params: { protocolVersion: "2025-06-18" },
            }),
            headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
            method: "POST",
        });

        await expect(metadata.json()).resolves.toMatchObject({ resource: `${ORIGIN}/mcp/` });
        expect(challenge.status).toBe(401);
        expect(challenge.headers.get("www-authenticate")).toContain(
            `${ORIGIN}/.well-known/oauth-protected-resource/mcp`
        );
    });

    it("keeps better-auth's RFC 8414 fields beside the agent_auth block", async () => {
        vi.stubEnv("SITE_URL", ORIGIN);
        const t = convexTest(schema, modules);

        const response = await t.fetch("/.well-known/oauth-authorization-server");

        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        await expect(response.json()).resolves.toMatchObject({
            agent_auth: { skill: "https://tryoutlayr.com/auth.md" },
            authorization_endpoint: `${ORIGIN}/api/auth/mcp/authorize`,
            code_challenge_methods_supported: ["S256"],
            issuer: ORIGIN,
            registration_endpoint: `${ORIGIN}/api/auth/mcp/register`,
            scopes_supported: expect.arrayContaining(["offline_access"]),
            token_endpoint: `${ORIGIN}/api/auth/mcp/token`,
        });
    });
});
