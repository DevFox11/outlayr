jest.mock("@bacons/apple-targets", () => ({
    ExtensionStorage: class {
        remove = jest.fn();
    },
}));
jest.mock("@react-native-async-storage/async-storage", () => ({ clear: jest.fn() }));
jest.mock("expo-alternate-app-icons", () => ({ setAlternateAppIcon: jest.fn(), supportsAlternateIcons: true }));
jest.mock("expo-core-spotlight", () => ({
    __esModule: true,
    default: { isAvailable: jest.fn(), removeAllItems: jest.fn() },
}));
jest.mock("expo-notifications", () => ({
    cancelAllScheduledNotificationsAsync: jest.fn(),
    dismissAllNotificationsAsync: jest.fn(),
    setBadgeCountAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
    deleteItemAsync: jest.fn(),
    getItem: jest.fn(),
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
}));
jest.mock("expo-sqlite", () => ({ deleteDatabaseAsync: jest.fn() }));
jest.mock("./photo-storage", () => ({ clearStoredPhotos: jest.fn() }));
jest.mock("./widget-bridge", () => ({ INTENT_SNAPSHOT_KEY: "intentSnapshot", PENDING_WRITES_KEY: "pendingWrites" }));

import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

import {
    beginDeviceReset,
    clearDeviceResetMarker,
    readDeviceResetMarker,
    recoverDeviceReset,
    resetAllDeviceData,
    retryDeviceReset,
    writeDeviceResetMarker,
} from "./device-data-reset";
import { DEVICE_STORES } from "./device-data-stores";
import type { DeviceDataStores } from "./device-data-stores";

function storesWith(calls: string[], failing: readonly string[] = []): DeviceDataStores {
    return Object.fromEntries(
        DEVICE_STORES.map((store) => [
            store,
            async () => {
                calls.push(store);
                if (failing.includes(store)) {
                    throw new Error(`${store} unavailable`);
                }
            },
        ])
    ) as DeviceDataStores;
}

describe("resetAllDeviceData", () => {
    it("partial-device-cleanup-discloses-failures-and-retries", async () => {
        const calls: string[] = [];
        const first = await resetAllDeviceData(storesWith(calls, ["credentials"]));

        expect(first.failures).toEqual(["credentials"]);
        expect(calls).toEqual(DEVICE_STORES);

        const second = await retryDeviceReset(
            {
                clearMarker: async () => {
                    calls.push("clear-marker");
                },
                stores: storesWith(calls),
            },
            first.failures
        );
        expect(second.failures).toEqual([]);
        expect(calls).toEqual([...DEVICE_STORES, "credentials", "clear-marker"]);
    });
});

test("reset-marker-resumes-after-crash and clears the marker last", async () => {
    const calls: string[] = [];
    let marker: { phase: "cloud" | "device"; v: 1 } | null = { phase: "cloud", v: 1 };

    await recoverDeviceReset({
        clearMarker: async () => {
            calls.push("clear-marker");
            marker = null;
        },
        completeCloudDeletion: async () => {
            calls.push("cloud");
        },
        readMarker: async () => marker,
        stores: storesWith(calls),
        writeMarker: async (next) => {
            calls.push(`marker-${next.phase}`);
            marker = next;
        },
    });

    expect(calls).toEqual(["cloud", "marker-device", ...DEVICE_STORES, "clear-marker"]);
    expect(marker).toBeNull();
});

test("persists the marker before cloud cleanup and never clears it when a store fails", async () => {
    const calls: string[] = [];
    let marker: { phase: "cloud" | "device"; v: 1 } | null = null;

    const result = await beginDeviceReset({
        clearMarker: async () => {
            calls.push("clear-marker");
            marker = null;
        },
        completeCloudDeletion: async () => {
            calls.push("cloud");
        },
        readMarker: async () => marker,
        stores: storesWith(calls, ["credentials"]),
        writeMarker: async (next) => {
            calls.push(`marker-${next.phase}`);
            marker = next;
        },
    });

    expect(result.failures).toEqual(["credentials"]);
    expect(calls).toEqual(["marker-cloud", "cloud", "marker-device", ...DEVICE_STORES]);
    expect(marker).toEqual({ phase: "device", v: 1 });
});

test("does not clean device stores when cloud completion fails", async () => {
    const calls: string[] = [];
    let marker: { phase: "cloud" | "device"; v: 1 } | null = { phase: "cloud", v: 1 };
    await expect(
        recoverDeviceReset({
            clearMarker: async () => {
                calls.push("clear-marker");
            },
            completeCloudDeletion: async () => {
                calls.push("cloud");
                throw new Error("cloud unavailable");
            },
            readMarker: async () => marker,
            stores: storesWith(calls),
            writeMarker: async (next) => {
                marker = next;
            },
        })
    ).rejects.toThrow("cloud unavailable");
    expect(calls).toEqual(["cloud"]);
    expect(marker).toEqual({ phase: "cloud", v: 1 });
});

test("persists and validates the SecureStore reset marker", async () => {
    const getMarker = getItemAsync as jest.MockedFunction<typeof getItemAsync>;
    const writeMarker = setItemAsync as jest.MockedFunction<typeof setItemAsync>;
    const eraseMarker = deleteItemAsync as jest.MockedFunction<typeof deleteItemAsync>;
    getMarker.mockResolvedValue(JSON.stringify({ phase: "device", v: 1 }));

    expect(await readDeviceResetMarker()).toEqual({ phase: "device", v: 1 });
    await writeDeviceResetMarker({ phase: "cloud", v: 1 });
    await clearDeviceResetMarker();

    expect(writeMarker).toHaveBeenCalledWith("outlayr.device-reset", JSON.stringify({ phase: "cloud", v: 1 }));
    expect(eraseMarker).toHaveBeenCalledWith("outlayr.device-reset");
});
