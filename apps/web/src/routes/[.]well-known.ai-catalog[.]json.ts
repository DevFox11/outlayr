import { createFileRoute } from "@tanstack/react-router";

import { LEDGER_SERVER_CARD, SERVER_CARD_TYPE } from "@/lib/mcp";
import { COMPANY, SITE_URL } from "@/lib/site";

const CATALOG_TYPE = "application/ai-catalog+json";

const catalog = {
    entries: [
        {
            identifier: "urn:air:tryoutlayr.com:mcp:outlayr",
            type: SERVER_CARD_TYPE,
            url: `${SITE_URL}/.well-known/mcp/server-card.json`,
        },
        { data: LEDGER_SERVER_CARD, identifier: "urn:air:tryoutlayr.com:mcp:ledger", type: SERVER_CARD_TYPE },
        {
            identifier: "urn:air:tryoutlayr.com:a2a:outlayr",
            type: "application/a2a-agent-card+json",
            url: `${SITE_URL}/.well-known/agent-card.json`,
        },
        {
            identifier: "urn:air:tryoutlayr.com:skill:outlayr",
            type: "application/agent-skills+md",
            url: `${SITE_URL}/.well-known/agent-skills/outlayr/SKILL.md`,
        },
    ],
    host: { displayName: COMPANY, identifier: "tryoutlayr.com" },
    specVersion: "1.0",
};

export const Route = createFileRoute("/.well-known/ai-catalog.json")({
    server: {
        handlers: {
            GET: ({ request }) =>
                Response.json(catalog, {
                    headers: {
                        "access-control-allow-origin": "*",
                        "cache-control": "public, max-age=3600",
                        "content-type": request.headers.get("accept")?.includes(CATALOG_TYPE)
                            ? CATALOG_TYPE
                            : "application/json",
                    },
                }),
        },
    },
});
