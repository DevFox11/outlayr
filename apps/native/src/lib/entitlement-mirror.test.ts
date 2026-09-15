import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { mirrorEntitlement } from "./entitlement-mirror";

const mockCloudAction = jest.fn<(path: string, args: Record<string, never>) => Promise<boolean>>();

// `convex` is read inside `mirrorEntitlement`, not at import, so a getter lets a
// test swap the configured build for an unconfigured one.
let mockConvex: object | null = {};
jest.mock("@/lib/convex", () => ({
    cloudAction: (path: string, args: Record<string, never>) => mockCloudAction(path, args),
    get convex() {
        return mockConvex;
    },
}));

beforeEach(() => {
    mockCloudAction.mockReset();
    mockConvex = {};
});

describe("mirrorEntitlement", () => {
    // The paywall suite can only see its own stand-in for this, so the action
    // path lives here: rename it on either side and nothing else goes red.
    it("asks the backend to copy the store's entitlement onto the account", async () => {
        mockCloudAction.mockResolvedValue(true);

        await expect(mirrorEntitlement()).resolves.toBe(true);
        expect(mockCloudAction).toHaveBeenCalledWith("revenuecat:syncFromStore", {});
    });

    it("reports the mirror behind when the backend says so", async () => {
        mockCloudAction.mockResolvedValue(false);

        await expect(mirrorEntitlement()).resolves.toBe(false);
    });

    // A paid user opening the paywall offline must not be told their entitlement
    // is mirrored, or `requirePro` gates them on a value nothing wrote.
    it("reports the mirror behind when the call fails", async () => {
        mockCloudAction.mockRejectedValue(new Error("offline"));

        await expect(mirrorEntitlement()).resolves.toBe(false);
    });

    it("reports a build with no backend as already mirrored", async () => {
        mockConvex = null;

        await expect(mirrorEntitlement()).resolves.toBe(true);
        expect(mockCloudAction).not.toHaveBeenCalled();
    });
});
