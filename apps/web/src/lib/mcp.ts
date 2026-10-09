import { z } from "zod";

import llms from "../../public/llms.txt?raw";
import { LEDGER_MCP_ORIGIN, SITE_URL } from "./site";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
const LLMS_URI = `${SITE_URL}/llms.txt`;

const SERVER_INFO = { name: "com.tryoutlayr/outlayr", title: "Outlayr", version: "1.0.0" };
const CAPABILITIES = { resources: {}, tools: {} };

const ABOUT_TOOL = {
    annotations: { openWorldHint: false, readOnlyHint: true },
    description:
        "What the Outlayr expense tracker does, its free and Pro plans, how it handles data, and links to every guide and comparison on tryoutlayr.com.",
    inputSchema: { properties: {}, type: "object" },
    name: "about_outlayr",
    title: "About Outlayr",
};

const LLMS_RESOURCE = {
    description: "Outlayr's features, plans, privacy, and pages, written for language models.",
    mimeType: "text/markdown",
    name: "llms.txt",
    title: "About Outlayr",
    uri: LLMS_URI,
};

export const SERVER_CARD_TYPE = "application/mcp-server-card+json";
const CARD_SCHEMA = "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";
const ICONS = [{ mimeType: "image/png", sizes: ["180x180"], src: `${SITE_URL}/apple-touch-icon.png` }];

export const SERVER_CARD = {
    $schema: CARD_SCHEMA,
    ...SERVER_INFO,
    capabilities: CAPABILITIES,
    description: "Read-only facts about the Outlayr expense tracker: features, plans, privacy, and guides.",
    icons: ICONS,
    remotes: [{ supportedProtocolVersions: PROTOCOL_VERSIONS, type: "streamable-http", url: `${SITE_URL}/mcp` }],
    serverInfo: SERVER_INFO,
    transport: { endpoint: "/mcp", type: "streamable-http" },
    websiteUrl: SITE_URL,
};

export const LEDGER_SERVER_CARD = {
    $schema: CARD_SCHEMA,
    description: "An Outlayr user's own entries and monthly spending, after they sign in and approve.",
    icons: ICONS,
    name: "com.tryoutlayr/ledger",
    remotes: [{ type: "streamable-http", url: `${LEDGER_MCP_ORIGIN}/mcp` }],
    title: "Outlayr ledger",
    version: "0.1.0",
    websiteUrl: `${SITE_URL}/auth.md`,
};

const JsonRpcMessage = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    jsonrpc: z.literal("2.0"),
    method: z.string(),
    params: z.object({ name: z.string(), protocolVersion: z.string(), uri: z.string() }).partial().default({}),
});

type JsonRpcRequest = z.infer<typeof JsonRpcMessage>;
type Outcome = { result: object } | { error: { code: number; message: string } };

function reply(id: JsonRpcRequest["id"] | null, outcome: Outcome, status = 200): Response {
    return Response.json({ id, jsonrpc: "2.0", ...outcome }, { status });
}

function dispatch({ method, params }: JsonRpcRequest): Outcome {
    switch (method) {
        case "initialize": {
            const protocolVersion =
                PROTOCOL_VERSIONS.find((version) => version === params.protocolVersion) ?? PROTOCOL_VERSIONS[0];
            return { result: { capabilities: CAPABILITIES, protocolVersion, serverInfo: SERVER_INFO } };
        }
        case "ping": {
            return { result: {} };
        }
        case "tools/list": {
            return { result: { tools: [ABOUT_TOOL] } };
        }
        case "tools/call": {
            return params.name === ABOUT_TOOL.name
                ? { result: { content: [{ text: llms, type: "text" }] } }
                : { error: { code: -32_602, message: `Unknown tool: ${params.name}` } };
        }
        case "resources/list": {
            return { result: { resources: [LLMS_RESOURCE] } };
        }
        case "resources/read": {
            return params.uri === LLMS_URI
                ? { result: { contents: [{ mimeType: LLMS_RESOURCE.mimeType, text: llms, uri: LLMS_URI }] } }
                : { error: { code: -32_002, message: `Resource not found: ${params.uri}` } };
        }
        default: {
            return { error: { code: -32_601, message: `Method not found: ${method}` } };
        }
    }
}

export async function handleMcp(request: Request): Promise<Response> {
    const message = JsonRpcMessage.safeParse(await request.json().catch(() => null));
    if (!message.success) {
        return reply(null, { error: { code: -32_600, message: "Expected one JSON-RPC request" } }, 400);
    }
    if (message.data.id === undefined) {
        return new Response(null, { status: 202 });
    }
    return reply(message.data.id, dispatch(message.data));
}
