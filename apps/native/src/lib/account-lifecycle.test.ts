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
                eraseBilling: async () => ({ phase: "billingErased" }),
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
        eraseBilling: async () => ({ phase: "billingErased" }),
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

test("erases billing when the purge lands, and resumes from purged the same way", async () => {
    const calls: string[] = [];
    const phases = ["purged", "authDeleting", "complete"] as const;
    let advances = 0;
    const deps = {
        advanceDeletion: async () => {
            calls.push("advance");
            advances += 1;
            return { phase: phases[advances - 1] ?? "complete" };
        },
        eraseBilling: async () => {
            calls.push("erase");
            return { phase: "billingErased" as const };
        },
        revokeProvider: async () => {
            calls.push("revoke");
        },
    };

    await resumeCloudDeletion("prepared", { receiptChallenge: "c", resumeSecret: "s" }, deps);
    expect(calls).toStrictEqual(["revoke", "advance", "erase", "advance", "advance"]);

    calls.length = 0;
    await resumeCloudDeletion("purged", { receiptChallenge: "c", resumeSecret: "s" }, deps);
    expect(calls[0]).toBe("erase");
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
        eraseBilling: async () => ({ phase: "billingErased" }),
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
