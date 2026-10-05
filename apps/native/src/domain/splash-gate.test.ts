import { describe, expect, it } from "@jest/globals";

import type { AdoptionStatus } from "@/lib/ledger-adoption";

import type { AuthGate } from "./auth-gate";
import { localShellReady, routeSettled } from "./splash-gate";

describe("local shell readiness", () => {
    it("holds while the fonts are still loading", () => {
        expect(
            localShellReady({
                data: "ready",
                fontsLoaded: false,
            })
        ).toBe(false);
    });

    it("holds while the database is opening", () => {
        expect(localShellReady({ data: "opening", fontsLoaded: true })).toBe(false);
    });

    it("holds on a database that failed to open", () => {
        expect(
            localShellReady({
                data: "error",
                fontsLoaded: true,
            })
        ).toBe(false);
    });

    it("opens once the fonts and the database are both in", () => {
        expect(
            localShellReady({
                data: "ready",
                fontsLoaded: true,
            })
        ).toBe(true);
    });
});

describe("route settlement", () => {
    it("holds while a session with no cached copy is being read", () => {
        expect(routeSettled({ adoption: "settled", gate: "restoring" })).toBe(false);
    });

    it("holds while the account's ledger is being reconciled", () => {
        expect(routeSettled({ adoption: "resolving", gate: "signed-in" })).toBe(false);
    });

    it("settles on a signed-in device with nothing to reconcile", () => {
        expect(routeSettled({ adoption: "settled", gate: "signed-in" })).toBe(true);
    });

    it("settles on a signed-out device, whose destination is the sign-in screen", () => {
        expect(routeSettled({ adoption: "settled", gate: "signed-out" })).toBe(true);
    });

    it("settles on a build with no auth client at all", () => {
        expect(routeSettled({ adoption: "settled", gate: "unconfigured" })).toBe(true);
    });

    it("local restore skips the account wait", () => {
        expect(routeSettled({ adoption: "resolving", gate: "unconfigured" })).toBe(true);
    });

    // The adopt screen is a destination, not a waypoint: holding the splash on it
    // would hide the only question that can move the app forward.
    it("settles once reconciliation has a question to ask", () => {
        expect(routeSettled({ adoption: "ask", gate: "signed-in" })).toBe(true);
    });

    it("settles while a chosen reconciliation runs", () => {
        expect(routeSettled({ adoption: "working", gate: "signed-in" })).toBe(true);
    });

    it("never holds once the restore budget has fallen through to sign-out", () => {
        const gates: AuthGate[] = ["signed-in", "signed-out", "unconfigured"];
        const settledStates: AdoptionStatus[] = ["settled", "ask", "working"];
        for (const gate of gates) {
            for (const adoption of settledStates) {
                expect(routeSettled({ adoption, gate })).toBe(true);
            }
        }
    });
});
