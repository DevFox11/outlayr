import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

import { resumePersistedCloudDeletion } from "./deletion-resume";

const mockRevokeGoogleProviderSubject = jest.fn();

jest.mock("expo-secure-store", () => ({
    deleteItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
}));
jest.mock("@/lib/auth-client", () => ({ authClient: null }));
// `convex` only has to be non-null — the module's own guard reads it — while the
// calls themselves go through the wrappers `convex.ts` exports.
jest.mock("@/lib/convex", () => ({
    cloudMutation: jest.fn(),
    cloudQuery: jest.fn(),
    convex: {},
}));
jest.mock("@/lib/provider-revocation", () => ({
    persistGoogleLocalReceiptAfterRevocation: async (revoke: () => Promise<void>, persist: () => Promise<void>) => {
        await revoke();
        await persist();
    },
    revokeGoogleProviderSubject: (...args: unknown[]) => mockRevokeGoogleProviderSubject(...args),
}));

function cloudMocks() {
    return jest.requireMock("@/lib/convex") as { cloudMutation: jest.Mock; cloudQuery: jest.Mock };
}

describe("resumePersistedCloudDeletion", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const { cloudMutation, cloudQuery } = cloudMocks();
        cloudQuery.mockResolvedValueOnce({ phase: "prepared" }).mockResolvedValueOnce({ phase: "complete" });
        cloudMutation.mockResolvedValueOnce({ phase: "providersRevoked" }).mockResolvedValueOnce({ phase: "complete" });
        (getItemAsync as jest.Mock).mockResolvedValue(
            JSON.stringify({
                provider: "google",
                providerSubject: "provider-subject",
                receiptChallenge: "challenge",
                resumeSecret: "secret",
            })
        );
    });

    it("resumes a cloud marker through the sessionless provider receipt and deletion job", async () => {
        await resumePersistedCloudDeletion({ clearOnComplete: false, required: true });
        const { cloudMutation } = cloudMocks();

        expect(mockRevokeGoogleProviderSubject).toHaveBeenCalledWith("provider-subject");
        expect(setItemAsync).toHaveBeenCalledWith(
            "outlayr.account-deletion-resume",
            expect.stringContaining("googleLocalReceipt")
        );
        expect(cloudMutation).toHaveBeenCalledWith("accountDeletion:submitGoogleLocalReceipt", {
            receiptChallenge: "challenge",
            resumeSecret: "secret",
        });
        expect(cloudMutation).toHaveBeenCalledWith("accountDeletion:advance", { resumeSecret: "secret" });
        expect(deleteItemAsync).not.toHaveBeenCalled();
    });

    it("fails closed when a cloud marker has no usable resume secret", async () => {
        (getItemAsync as jest.Mock).mockResolvedValue(null);

        await expect(resumePersistedCloudDeletion({ required: true })).rejects.toThrow("requires reauthentication");
        expect(cloudMocks().cloudMutation).not.toHaveBeenCalled();
    });

    it("maps an expired deletion job to reauthentication without advancing device cleanup", async () => {
        const { cloudMutation, cloudQuery } = cloudMocks();
        cloudQuery.mockReset();
        cloudQuery.mockResolvedValue(null);

        await expect(resumePersistedCloudDeletion({ required: true })).rejects.toThrow("requires reauthentication");
        expect(cloudMutation).not.toHaveBeenCalled();
    });
});
