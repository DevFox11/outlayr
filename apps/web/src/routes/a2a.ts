import { createFileRoute } from "@tanstack/react-router";

import { answerA2a } from "@/lib/a2a";

export const Route = createFileRoute("/a2a")({
    server: {
        handlers: {
            GET: () => new Response(null, { headers: { allow: "POST" }, status: 405 }),
            POST: ({ request }) => answerA2a(request),
        },
    },
});
