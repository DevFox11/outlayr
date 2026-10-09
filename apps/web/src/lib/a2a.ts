import { z } from "zod";

import facts from "../../public/llms.txt?raw";

const RpcCall = z.object({
    id: z.union([z.string(), z.number()]).nullish(),
    jsonrpc: z.literal("2.0"),
    method: z.string(),
    params: z.unknown(),
});

const SendMessageParams = z.object({
    message: z.object({ contextId: z.string().optional(), parts: z.array(z.unknown()) }),
});

interface AgentMessage {
    contextId: string;
    messageId: string;
    parts: { mediaType: string; text: string }[];
    role: "ROLE_AGENT";
}
type RpcOutcome = { result: { message: AgentMessage } } | { error: { code: number; message: string } };

const SUPPORTED_VERSION = /^1\.0(?:\.|$)/u;

function reply(id: string | number | null, outcome: RpcOutcome): Response {
    return Response.json({ id, jsonrpc: "2.0", ...outcome });
}

export async function answerA2a(request: Request): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return reply(null, { error: { code: -32_700, message: "Parse error" } });
    }
    const call = RpcCall.safeParse(body);
    if (!call.success) {
        return reply(null, { error: { code: -32_600, message: "Invalid Request" } });
    }
    const id = call.data.id ?? null;
    const version = request.headers.get("a2a-version") ?? new URL(request.url).searchParams.get("A2A-Version") ?? "";
    if (!SUPPORTED_VERSION.test(version)) {
        return reply(id, { error: { code: -32_009, message: "Only A2A-Version 1.0 is supported" } });
    }
    if (call.data.method !== "SendMessage") {
        return reply(id, { error: { code: -32_601, message: "Method not found" } });
    }
    const params = SendMessageParams.safeParse(call.data.params);
    if (!params.success) {
        return reply(id, { error: { code: -32_602, message: "params.message with parts is required" } });
    }
    return reply(id, {
        result: {
            message: {
                contextId: params.data.message.contextId ?? crypto.randomUUID(),
                messageId: crypto.randomUUID(),
                parts: [{ mediaType: "text/markdown", text: facts }],
                role: "ROLE_AGENT",
            },
        },
    });
}
