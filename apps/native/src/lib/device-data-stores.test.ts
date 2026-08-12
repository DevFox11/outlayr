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
jest.mock("expo-secure-store", () => ({ deleteItemAsync: jest.fn(), getItem: jest.fn() }));
jest.mock("expo-sqlite", () => ({ deleteDatabaseAsync: jest.fn() }));
jest.mock("./photo-storage", () => ({ clearStoredPhotos: jest.fn() }));
jest.mock("./widget-bridge", () => ({ INTENT_SNAPSHOT_KEY: "intentSnapshot", PENDING_WRITES_KEY: "pendingWrites" }));

import { DEVICE_STORES, NON_ERASABLE_DEVICE_STATE } from "./device-data-stores";

describe("concrete device reset inventory", () => {
	it.each(DEVICE_STORES)("reset-clears-%s", async (store) => {
		const calls: string[] = [];
		const adapters = Object.fromEntries(DEVICE_STORES.map((name) => [name, async () => calls.push(name)]));

		await adapters[store]();

		expect(calls).toEqual([store]);
	});

	it("discloses non-erasable operating-system state", () => {
		expect(NON_ERASABLE_DEVICE_STATE).toEqual([
			"biometricEnrollment",
			"notificationPermission",
			"photoPermission",
			"widgetPlacement",
		]);
	});
});
