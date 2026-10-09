import { createFileRoute } from "@tanstack/react-router";

import { handleMcp } from "@/lib/mcp";

export const Route = createFileRoute("/mcp")({
    server: {
        handlers: {
            GET: () => new Response(null, { headers: { allow: "POST" }, status: 405 }),
            POST: ({ request }) => handleMcp(request),
        },
    },
});
