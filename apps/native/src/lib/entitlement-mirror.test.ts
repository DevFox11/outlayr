import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { mirrorEntitlement } from "./entitlement-mirror";

const mockCloudAction = jest.fn<(path: string, args: Record<string, never>) => Promise<boolean>>();

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
    it("reports the mirror behind when the backend says so", async () => {
        mockCloudAction.mockResolvedValue(false);

        await expect(mirrorEntitlement()).resolves.toBe(false);
    });

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
