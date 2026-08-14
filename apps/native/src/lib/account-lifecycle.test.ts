import { describe, expect, it, test } from "@jest/globals";

import { resumeCloudDeletion, runAccountLifecycle } from "./account-lifecycle";

describe("runAccountLifecycle", () => {
    it("keeps deletion incomplete and retryable when revocation fails", async () => {
        const calls: string[] = [];
        await expect(
            runAccountLifecycle("deleteCloud", {
                advanceDeletion: async () => ({ phase: "complete" }),
                allowLocal: () => calls.push("allowLocal"),
                clearDeletionSecret: async () => undefined,
                deleteAccount: async () => {
                    calls.push("deleteAccount");
                },
                navigateToLedger: () => calls.push("navigate"),
                persistDeletionSecret: async () => undefined,
                prepareDeletion: async () => ({ receiptChallenge: "receipt-challenge", resumeSecret: "resume-secret" }),
                quiesce: async () => {
                    calls.push("quiesce");
                },
                revokeProvider: async () => {
                    calls.push("revokeProvider");
                    throw new Error("revocation unavailable");
                },
            })
        ).rejects.toMatchObject({ stage: "revokeProvider" });

        expect(calls).toStrictEqual(["allowLocal", "quiesce", "revokeProvider"]);
    });

    it("signs out without revoking provider authorization", async () => {
        const calls: string[] = [];
        await runAccountLifecycle("signOut", {
            allowLocal: () => calls.push("allowLocal"),
            deleteAccount: async () => {
                calls.push("deleteAccount");
            },
            navigateToLedger: () => calls.push("navigate"),
            quiesce: async () => {
                calls.push("quiesce");
            },
            revokeProvider: async () => {
                calls.push("revokeProvider");
            },
            signOut: async () => {
                calls.push("signOut");
            },
        });

        expect(calls).toStrictEqual(["allowLocal", "quiesce", "signOut", "navigate"]);
    });
});

test("persists the resume secret before revocation and advances idempotently", async () => {
    const calls: string[] = [];
    await runAccountLifecycle("deleteCloud", {
        advanceDeletion: async () => ({ phase: "complete" }),
        allowLocal: () => calls.push("allowLocal"),
        clearDeletionSecret: async () => {
            calls.push("clear");
        },
        deleteAccount: async () => {
            calls.push("deleteAccount");
        },
        navigateToLedger: () => calls.push("navigate"),
        persistDeletionSecret: async () => {
            calls.push("persist");
        },
        prepareDeletion: async () => ({ receiptChallenge: "receipt-challenge", resumeSecret: "resume-secret" }),
        quiesce: async () => {
            calls.push("quiesce");
        },
        revokeProvider: async () => {
            calls.push("revoke");
        },
    });

    expect(calls).toStrictEqual(["allowLocal", "quiesce", "persist", "revoke", "clear", "navigate"]);
});

test("resumes a prepared deletion by retrying provider revocation before advancing", async () => {
    const calls: string[] = [];

    await resumeCloudDeletion(
        "prepared",
        { receiptChallenge: "receipt-challenge", resumeSecret: "resume-secret" },
        {
            advanceDeletion: async () => {
                calls.push("advance");
                return { phase: "complete" };
            },
            revokeProvider: async () => {
                calls.push("revoke");
            },
        }
    );

    expect(calls).toStrictEqual(["revoke", "advance"]);
});

test("does not clean the device before cloud deletion completes", async () => {
    const calls: string[] = [];
    await runAccountLifecycle("deleteAll", {
        advanceDeletion: async () => {
            calls.push("advance");
            return { phase: "complete" };
        },
        allowLocal: () => calls.push("allowLocal"),
        beginDeviceReset: async () => {
            calls.push("marker-cloud");
        },
        clearDeletionSecret: async () => {
            calls.push("clear-secret");
        },
        deleteAccount: async () => undefined,
        markDeviceCleanupReady: async () => {
            calls.push("marker-device");
        },
        navigateToLedger: () => calls.push("ledger"),
        navigateToOnboarding: () => calls.push("onboarding"),
        persistDeletionSecret: async () => {
            calls.push("persist-secret");
        },
        prepareDeletion: async () => ({ receiptChallenge: "receipt-challenge", resumeSecret: "resume-secret" }),
        quiesce: async () => {
            calls.push("quiesce");
        },
        resetDevice: async () => {
            calls.push("reset-device");
            return { failures: [] };
        },
        revokeProvider: async () => {
            calls.push("revoke");
        },
    });

    expect(calls).toStrictEqual([
        "allowLocal",
        "quiesce",
        "marker-cloud",
        "persist-secret",
        "revoke",
        "advance",
        "marker-device",
        "clear-secret",
        "reset-device",
        "onboarding",
    ]);
});
