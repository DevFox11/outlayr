import type { AdoptionStatus } from "@/lib/ledger-adoption";
import type { AuthGate } from "./auth-gate";
import { localShellReady, routeSettled } from "./splash-gate";

describe("local shell readiness", () => {
	it("holds while the fonts are still loading", () => {
		expect(
			localShellReady({
				fontsLoaded: false,
				languageReady: true,
				data: "ready",
			}),
		).toBe(false);
	});

	it("holds while the language catalog is hydrating", () => {
		expect(
			localShellReady({
				fontsLoaded: true,
				languageReady: false,
				data: "ready",
			}),
		).toBe(false);
	});

	it.each(["opening", "migrating", "seeding"] as const)(
		"holds while the database is %s",
		(data) => {
			expect(
				localShellReady({ fontsLoaded: true, languageReady: true, data }),
			).toBe(false);
		},
	);

	it("holds on a database that failed to open", () => {
		expect(
			localShellReady({
				fontsLoaded: true,
				languageReady: true,
				data: "error",
			}),
		).toBe(false);
	});

	it("opens once the fonts, the catalog and the database are all in", () => {
		expect(
			localShellReady({
				fontsLoaded: true,
				languageReady: true,
				data: "ready",
			}),
		).toBe(true);
	});
});

describe("route settlement", () => {
	it("holds while a session with no cached copy is being read", () => {
		expect(routeSettled({ gate: "restoring", adoption: "settled" })).toBe(
			false,
		);
	});

	it("holds while the account's ledger is being reconciled", () => {
		expect(routeSettled({ gate: "signed-in", adoption: "resolving" })).toBe(
			false,
		);
	});

	it("settles on a signed-in device with nothing to reconcile", () => {
		expect(routeSettled({ gate: "signed-in", adoption: "settled" })).toBe(true);
	});

	it("settles on a signed-out device, whose destination is the sign-in screen", () => {
		expect(routeSettled({ gate: "signed-out", adoption: "settled" })).toBe(
			true,
		);
	});

	it("settles on a build with no auth client at all", () => {
		expect(routeSettled({ gate: "unconfigured", adoption: "settled" })).toBe(
			true,
		);
	});

	// The adopt screen is a destination, not a waypoint: holding the splash on it
	// would hide the only question that can move the app forward.
	it("settles once reconciliation has a question to ask", () => {
		expect(routeSettled({ gate: "signed-in", adoption: "ask" })).toBe(true);
	});

	it("settles while a chosen reconciliation runs", () => {
		expect(routeSettled({ gate: "signed-in", adoption: "working" })).toBe(true);
	});

	it("never holds once the restore budget has fallen through to sign-out", () => {
		const gates: AuthGate[] = ["signed-in", "signed-out", "unconfigured"];
		const settledStates: AdoptionStatus[] = ["settled", "ask", "working"];
		for (const gate of gates) {
			for (const adoption of settledStates) {
				expect(routeSettled({ gate, adoption })).toBe(true);
			}
		}
	});
});
