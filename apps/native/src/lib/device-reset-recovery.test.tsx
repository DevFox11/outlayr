import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { testLocalData as mockTestLocalData } from "@/contexts/test-local-data";
import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { DeviceResetRecovery, retryBeforeClosingDatabase } from "./device-reset-recovery";

const mockRecover = jest.fn<typeof import("@/lib/device-data-reset").recoverDeviceReset>();
const mockResumePersistedCloudDeletion = jest.fn<typeof import("@/lib/deletion-resume").resumePersistedCloudDeletion>();
let mockCompleteCloudDeletion: (() => Promise<void>) | undefined;
const mockDatabase = mockUnusedDatabase();
const mockRetry = jest.fn();
jest.mock("@/contexts/local-data-context", () => ({
    useLocalData: () => mockTestLocalData({ db: mockDatabase, retry: mockRetry }),
}));
jest.mock("@/db/client", () => ({ closeDatabase: jest.fn() }));
jest.mock("./deletion-resume", () => ({
    resumePersistedCloudDeletion: (...args: Parameters<typeof mockResumePersistedCloudDeletion>) =>
        mockResumePersistedCloudDeletion(...args),
}));
jest.mock("./device-data-reset", () => ({
    createDeviceResetGate: ({ completeCloudDeletion }: { completeCloudDeletion: () => Promise<void> }) => {
        mockCompleteCloudDeletion = completeCloudDeletion;
        return { recover: mockRecover };
    },
}));

describe("deviceResetRecovery", () => {
    beforeEach(() => {
        mockRecover.mockReset();
        mockResumePersistedCloudDeletion.mockReset();
        mockRetry.mockReset();
        mockCompleteCloudDeletion = undefined;
    });

    it("invokes persisted-marker recovery before rendering the root child", async () => {
        mockResumePersistedCloudDeletion.mockResolvedValue(true);
        mockRecover.mockImplementation(async () => {
            await mockCompleteCloudDeletion?.();
            return { failures: [] };
        });
        const { getByText } = await render(
            <DeviceResetRecovery>
                <Text>ledger</Text>
            </DeviceResetRecovery>
        );
        await waitFor(() => expect(mockRecover).toHaveBeenCalledTimes(1));
        expect(mockResumePersistedCloudDeletion).toHaveBeenCalledWith({ clearOnComplete: false, required: true });
        expect(getByText("ledger")).toBeTruthy();
    });

    it("discloses a failed recovery and retries it before rendering the ledger", async () => {
        mockResumePersistedCloudDeletion
            .mockRejectedValueOnce(new Error("network unavailable"))
            .mockResolvedValueOnce(true);
        mockRecover.mockImplementation(async () => {
            await mockCompleteCloudDeletion?.();
            return { failures: [] };
        });
        const { getByRole, getByText, queryByText } = await render(
            <DeviceResetRecovery>
                <Text>ledger</Text>
            </DeviceResetRecovery>
        );
        await waitFor(() => expect(getByText("settings.account.resetFailedTitle")).toBeTruthy());
        expect(queryByText("ledger")).toBeNull();
        await act(async () => {
            fireEvent.press(getByRole("button", { name: "common.retry" }));
        });
        await waitFor(() => expect(getByText("ledger")).toBeTruthy());
        expect(mockRecover).toHaveBeenCalledTimes(2);
        expect(mockResumePersistedCloudDeletion).toHaveBeenCalledTimes(2);
    });

    it("keeps the root opaque when the cloud marker has no usable resume material", async () => {
        mockResumePersistedCloudDeletion.mockRejectedValue(
            new Error("Cloud deletion recovery requires reauthentication")
        );
        mockRecover.mockImplementation(async () => {
            await mockCompleteCloudDeletion?.();
            return { failures: [] };
        });
        const { getByText, queryByText } = await render(
            <DeviceResetRecovery>
                <Text>ledger</Text>
            </DeviceResetRecovery>
        );
        await waitFor(() => expect(getByText("Cloud deletion recovery requires reauthentication")).toBeTruthy());
        expect(queryByText("ledger")).toBeNull();
    });

    it("transitions local data before closing the database", async () => {
        const events: string[] = [];

        await retryBeforeClosingDatabase(
            () => events.push("retry"),
            async () => {
                events.push("close");
            }
        );

        expect(events).toStrictEqual(["retry", "close"]);
    });
});
