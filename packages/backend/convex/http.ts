import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { authorizationServerMetadata, handleMcp, protectedResourceMetadata } from "./mcp";
import { consentPage, loginPage } from "./mcpPages";
import { revenuecat } from "./revenuecat";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

revenuecat.registerRoutes(http);

const mcpHandler = httpAction(handleMcp);
for (const path of ["/mcp", "/mcp/"]) {
    for (const method of ["GET", "POST", "DELETE"] as const) {
        http.route({ handler: mcpHandler, method, path });
    }
}

http.route({ handler: httpAction(async () => loginPage()), method: "GET", path: "/mcp/login" });
http.route({ handler: httpAction(consentPage), method: "GET", path: "/mcp/consent" });

http.route({
    handler: httpAction(protectedResourceMetadata),
    method: "GET",
    path: "/.well-known/oauth-protected-resource/mcp",
});

http.route({
    handler: httpAction(authorizationServerMetadata),
    method: "GET",
    path: "/.well-known/oauth-authorization-server",
});

http.route({
    handler: httpAction(async () => Response.redirect("https://github.com/danestves/outlayr", 302)),
    method: "GET",
    path: "/source",
});

export default http;
