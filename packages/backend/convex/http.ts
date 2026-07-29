import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

http.route({
	path: "/source",
	method: "GET",
	handler: httpAction(async () => {
		return Response.redirect("https://github.com/danestves/outlayr", 302);
	}),
});

export default http;
