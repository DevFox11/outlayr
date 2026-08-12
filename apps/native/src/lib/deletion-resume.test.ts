import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import { resumePersistedCloudDeletion } from "./deletion-resume";

const mockRevokeGoogleProviderSubject = jest.fn();

jest.mock("expo-secure-store", () => ({
	deleteItemAsync: jest.fn(),
	getItemAsync: jest.fn(),
	setItemAsync: jest.fn(),
}));
jest.mock("@/lib/auth-client", () => ({ authClient: null }));
jest.mock("@/lib/convex", () => ({ convex: { mutation: jest.fn(), query: jest.fn() } }));
jest.mock("@/lib/provider-revocation", () => ({
	persistGoogleLocalReceiptAfterRevocation: async (revoke: () => Promise<void>, persist: () => Promise<void>) => {
		await revoke();
		await persist();
	},
	revokeGoogleProviderSubject: (...args: unknown[]) => mockRevokeGoogleProviderSubject(...args),
}));

describe("resumePersistedCloudDeletion", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		const { convex } = jest.requireMock("@/lib/convex") as {
			convex: { mutation: jest.Mock; query: jest.Mock };
		};
		const mockQuery = convex.query;
		const mockMutation = convex.mutation;
		mockQuery.mockResolvedValueOnce({ phase: "prepared" }).mockResolvedValueOnce({ phase: "complete" });
		mockMutation.mockResolvedValueOnce({ phase: "providersRevoked" }).mockResolvedValueOnce({ phase: "complete" });
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
		const { convex } = jest.requireMock("@/lib/convex") as {
			convex: { mutation: jest.Mock };
		};

		expect(mockRevokeGoogleProviderSubject).toHaveBeenCalledWith("provider-subject");
		expect(setItemAsync).toHaveBeenCalledWith(
			"outlayr.account-deletion-resume",
			expect.stringContaining("googleLocalReceipt")
		);
		expect(convex.mutation).toHaveBeenCalledWith("accountDeletion:submitGoogleLocalReceipt", {
			receiptChallenge: "challenge",
			resumeSecret: "secret",
		});
		expect(convex.mutation).toHaveBeenCalledWith("accountDeletion:advance", { resumeSecret: "secret" });
		expect(deleteItemAsync).not.toHaveBeenCalled();
	});

	it("fails closed when a cloud marker has no usable resume secret", async () => {
		(getItemAsync as jest.Mock).mockResolvedValue(null);

		await expect(resumePersistedCloudDeletion({ required: true })).rejects.toThrow("requires reauthentication");
		const { convex } = jest.requireMock("@/lib/convex") as {
			convex: { mutation: jest.Mock };
		};
		expect(convex.mutation).not.toHaveBeenCalled();
	});

	it("maps an expired deletion job to reauthentication without advancing device cleanup", async () => {
		const { convex } = jest.requireMock("@/lib/convex") as {
			convex: { mutation: jest.Mock; query: jest.Mock };
		};
		convex.query.mockReset();
		convex.query.mockResolvedValue(null);

		await expect(resumePersistedCloudDeletion({ required: true })).rejects.toThrow("requires reauthentication");
		expect(convex.mutation).not.toHaveBeenCalled();
	});
});
