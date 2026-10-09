import { McpGateway } from "convex-mcp-gateway";
import { v } from "convex/values";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { createAuth } from "./auth";
import { entryTools } from "./mcpEntries";
import { ledgerTools } from "./mcpLedger";

const gateway = new McpGateway(components.mcpGateway);

export const configureOAuth = internalMutation({
    args: { authServerUrl: v.string() },
    handler: async (ctx, { authServerUrl }) => {
        await gateway.setOAuthConfig(ctx, { authServerUrl });
    },
});

const DAY_MS = 86_400_000;
const AUDIT_RETENTION_MS = 30 * DAY_MS;

export const pruneRecords = internalMutation({
    args: {},
    handler: async (ctx): Promise<void> => {
        const audit = await gateway.pruneAuditEntries(ctx, AUDIT_RETENTION_MS);
        const sessions = await gateway.pruneSessions(ctx, DAY_MS);
        if (audit > 0 || sessions > 0) {
            await ctx.scheduler.runAfter(0, internal.mcp.pruneRecords, {});
        }
    },
});

const tools = [...ledgerTools, ...entryTools];

async function onSiteOrigin(request: Request): Promise<Request> {
    const site = process.env.CONVEX_SITE_URL;
    if (!site) {
        return request;
    }
    const { pathname, search } = new URL(request.url);
    const url = new URL(`${pathname}${search}`, site);
    const bodiless = request.method === "GET" || request.method === "HEAD";
    return new Request(url, {
        body: bodiless ? undefined : await request.arrayBuffer(),
        headers: request.headers,
        method: request.method,
    });
}

export async function handleMcp(ctx: ActionCtx, request: Request): Promise<Response> {
    return await gateway.handleMcpRequest(ctx, await onSiteOrigin(request), {
        authorize: async (_ctx, { identity }) =>
            identity ? { allowed: true } : { allowed: false, reason: "Unauthorized" },
        requireAuth: true,
        resolveIdentity: async (token) => {
            const session = await createAuth(ctx).api.getMcpSession({
                headers: new Headers({ authorization: `Bearer ${token}` }),
            });
            if (!session || new Date(session.accessTokenExpiresAt).getTime() <= Date.now()) {
                return null;
            }
            return { claims: { scopes: session.scopes }, subject: session.userId };
        },
        serverInfo: { name: "com.tryoutlayr/ledger", title: "Outlayr ledger", version: "0.1.0" },
        tools,
    });
}

const AUTH_MD = "https://tryoutlayr.com/auth.md";

const GatewayMetadata = z.looseObject({});

export async function protectedResourceMetadata(ctx: ActionCtx, request: Request): Promise<Response> {
    const response = await gateway.serveProtectedResourceMetadata(ctx, await onSiteOrigin(request));
    if (!response.ok) {
        return response;
    }
    return Response.json(
        {
            ...GatewayMetadata.parse(await response.json()),
            resource_documentation: AUTH_MD,
            resource_name: "Outlayr",
            scopes_supported: ["offline_access"],
        },
        { headers: response.headers }
    );
}

export async function authorizationServerMetadata(ctx: ActionCtx, request: Request): Promise<Response> {
    const metadata = await createAuth(ctx).api.getMcpOAuthConfig({ asResponse: false, request });
    return Response.json(metadata && { ...metadata, agent_auth: { skill: AUTH_MD }, service_documentation: AUTH_MD }, {
        headers: { "access-control-allow-origin": "*" },
    });
}
