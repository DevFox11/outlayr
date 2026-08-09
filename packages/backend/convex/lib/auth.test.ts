/// <reference types="vite/client" />

import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import schema from "../schema";
import { authenticatedAs, seedAuthUser } from "../test.helpers";
import { optionalUserId, requireUserId } from "./auth";

const modules = import.meta.glob("../**/*.ts");

describe("requireUserId", () => {
	test("returns the Better Auth user id for an authenticated caller", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		const resolved = await authenticatedAs(t, identity).run((ctx) => requireUserId(ctx));

		expect(resolved).toBe(identity.userId);
	});

	test("throws a ConvexError when there is no identity", async () => {
		const t = convexTest(schema, modules);

		await expect(t.run((ctx) => requireUserId(ctx))).rejects.toThrow(ConvexError);
	});

	test("throws when the identity names a session that does not exist", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		const stale = t.withIdentity({
			sessionId: "session-that-was-revoked",
			subject: identity.subject,
		});

		await expect(stale.run((ctx) => requireUserId(ctx))).rejects.toThrow(ConvexError);
	});

	test("scopes two signed-in users to distinct ids", async () => {
		const t = convexTest(schema, modules);
		const first = await seedAuthUser(t);
		const second = await seedAuthUser(t);

		const firstId = await authenticatedAs(t, first).run((ctx) => requireUserId(ctx));
		const secondId = await authenticatedAs(t, second).run((ctx) => requireUserId(ctx));

		expect(firstId).not.toBe(secondId);
	});
});

describe("optionalUserId", () => {
	test("returns the Better Auth user id for an authenticated caller", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		const resolved = await authenticatedAs(t, identity).run((ctx) => optionalUserId(ctx));

		expect(resolved).toBe(identity.userId);
	});

	test("returns null when there is no identity", async () => {
		const t = convexTest(schema, modules);

		await expect(t.run((ctx) => optionalUserId(ctx))).resolves.toBeNull();
	});

	test("returns null when the identity names a session that does not exist", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		const stale = t.withIdentity({
			sessionId: "session-that-was-revoked",
			subject: identity.subject,
		});

		await expect(stale.run((ctx) => optionalUserId(ctx))).resolves.toBeNull();
	});
});
