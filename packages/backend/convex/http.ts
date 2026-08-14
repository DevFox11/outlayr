import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

http.route({
    handler: httpAction(async () => Response.redirect("https://github.com/danestves/outlayr", 302)),
    method: "GET",
    path: "/source",
});

export default http;
