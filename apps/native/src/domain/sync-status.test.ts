import { describe, expect, it } from "@jest/globals";

import { effectiveCapabilityStatus, ownsSyncSwitch, syncPresentation, syncStatusLabel } from "./sync-status";

const AT = new Date(1_700_000_000_000);

describe("syncStatusLabel", () => {
    it("reads an empty queue as up to date, not as zero pending", () => {
        expect(syncStatusLabel(0, AT)).toStrictEqual({
            key: "settings.sync.upToDate",
        });
    });

    it("does not claim up to date on a device that has never synced", () => {
        expect(syncStatusLabel(0, null)).toStrictEqual({
            key: "settings.sync.never",
        });
    });

    it("counts a single pending row without pluralising it", () => {
        expect(syncStatusLabel(1, AT)).toStrictEqual({
            key: "settings.sync.pendingOne",
        });
    });

    it("carries the count once there is more than one", () => {
        expect(syncStatusLabel(7, AT)).toStrictEqual({
            count: 7,
            key: "settings.sync.pending",
        });
    });

    it("reports pending work even before a first successful cycle", () => {
        expect(syncStatusLabel(3, null)).toStrictEqual({
            count: 3,
            key: "settings.sync.pending",
        });
    });
});

describe("effective capability status", () => {
    it("unconfigured-sync-adoption-photo-status-is-unavailable-without-account", () => {
        expect(
            effectiveCapabilityStatus({
                accountId: null,
                cloud: "unconfigured",
                local: false,
                pending: 9,
                syncEnabled: true,
                syncedAt: AT,
            })
        ).toStrictEqual({ kind: "unavailable" });
    });

    it("keeps remote capabilities account-required until sign-in", () => {
        expect(
            effectiveCapabilityStatus({
                accountId: null,
                cloud: "configured",
                local: false,
                pending: 0,
                syncEnabled: false,
                syncedAt: null,
            })
        ).toStrictEqual({ kind: "accountRequired" });
    });

    it("same-account-sync-off-offers-enable", () => {
        expect(
            effectiveCapabilityStatus({
                accountId: "account-a",
                cloud: "configured",
                local: false,
                pending: 7,
                syncEnabled: false,
                syncedAt: AT,
            })
        ).toStrictEqual({ enableSync: true, kind: "syncOff" });
    });
});

describe("syncPresentation", () => {
    it("names the build as unavailable before it names the account", () => {
        expect(syncPresentation("unavailable", false)).toStrictEqual({
            detail: "settings.account.unavailableDetail",
            title: "settings.account.unavailable",
        });
    });

    it("asks for an account without claiming sync is off", () => {
        expect(syncPresentation("accountRequired", false)).toStrictEqual({
            detail: "settings.sync.needsAccount",
            title: "settings.account.notSignedIn",
        });
    });

    it("reads the switch only once the capability settled", () => {
        expect(syncPresentation("syncOff", false).title).toBe("settings.sync.off");
        expect(syncPresentation("active", true).title).toBe("settings.sync.on");
    });

    it("ignores the switch position for a kind that has no switch", () => {
        expect(syncPresentation("unavailable", true).title).toBe("settings.account.unavailable");
        expect(syncPresentation("accountRequired", true).title).toBe("settings.account.notSignedIn");
    });
});

describe("ownsSyncSwitch", () => {
    it("withholds the switch until adoption settles", () => {
        expect(ownsSyncSwitch("active", "reconciling")).toBe(false);
        expect(ownsSyncSwitch("syncOff", "reconciling")).toBe(false);
    });

    it("offers the switch for both settled capabilities", () => {
        expect(ownsSyncSwitch("active", "settled")).toBe(true);
        expect(ownsSyncSwitch("syncOff", "settled")).toBe(true);
    });

    it("withholds the switch from a device with no account or no cloud", () => {
        expect(ownsSyncSwitch("accountRequired", "settled")).toBe(false);
        expect(ownsSyncSwitch("unavailable", "settled")).toBe(false);
    });
});
