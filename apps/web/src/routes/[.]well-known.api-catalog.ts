import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site";

const catalog = {
    linkset: [
        {
            anchor: `${SITE_URL}/`,
            "service-desc": [{ href: `${SITE_URL}/openapi.json`, type: "application/json" }],
            "service-doc": [{ href: `${SITE_URL}/llms.txt`, type: "text/plain" }],
        },
    ],
};

export const Route = createFileRoute("/.well-known/api-catalog")({
    server: {
        handlers: {
            GET: () =>
                Response.json(catalog, {
                    headers: {
                        "cache-control": "public, max-age=3600",
                        "content-type": 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
                        link: `<${SITE_URL}/.well-known/api-catalog>; rel="api-catalog"`,
                    },
                }),
        },
    },
});
