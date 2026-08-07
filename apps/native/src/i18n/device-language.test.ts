import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

jest.mock("./language-storage", () => ({
	deviceLanguageTag: jest.fn(),
}));

import { useDeviceLanguageTag } from "./device-language";
import { deviceLanguageTag } from "./language-storage";

const mockDeviceLanguageTag = deviceLanguageTag as jest.Mock;

const realAddEventListener = AppState.addEventListener;

/**
 * Captures every listener the hook registers so a test can drive AppState
 * transitions directly, and reports whether each was later removed.
 */
function watchAppState() {
	const listeners: ((status: AppStateStatus) => void)[] = [];
	const remove = jest.fn();

	// Assigned rather than spied: `jest.restoreAllMocks` also reverts the
	// `language-storage` module mock, and restoring spies one at a time still
	// left a later test running an earlier test's implementation.
	AppState.addEventListener = ((event: string, listener: unknown) => {
		if (event === "change") {
			listeners.push(listener as (status: AppStateStatus) => void);
		}
		return { remove };
	}) as typeof AppState.addEventListener;

	return {
		remove,
		async emit(status: AppStateStatus) {
			await act(async () => {
				for (const listener of listeners) {
					listener(status);
				}
			});
		},
	};
}

afterEach(() => {
	AppState.addEventListener = realAddEventListener;
	mockDeviceLanguageTag.mockReset();
});

describe("useDeviceLanguageTag", () => {
	it("returns the tag read at mount", async () => {
		watchAppState();
		mockDeviceLanguageTag.mockReturnValue("en-US");

		const { result } = await renderHook(() => useDeviceLanguageTag());

		expect(result.current).toBe("en-US");
	});

	it("re-reads the tag when the app returns to the foreground", async () => {
		const appState = watchAppState();
		mockDeviceLanguageTag.mockReturnValue("en-US");
		const { result } = await renderHook(() => useDeviceLanguageTag());

		mockDeviceLanguageTag.mockReturnValue("es-MX");
		await appState.emit("active");

		expect(result.current).toBe("es-MX");
	});

	it("does not re-read while the app is heading to the background", async () => {
		const appState = watchAppState();
		mockDeviceLanguageTag.mockReturnValue("en-US");
		const { result } = await renderHook(() => useDeviceLanguageTag());

		mockDeviceLanguageTag.mockReturnValue("es-MX");
		await appState.emit("background");

		expect(result.current).toBe("en-US");
	});

	it("notifies every mounted consumer, not just the first", async () => {
		const appState = watchAppState();
		mockDeviceLanguageTag.mockReturnValue("en-US");
		const first = await renderHook(() => useDeviceLanguageTag());
		const second = await renderHook(() => useDeviceLanguageTag());

		mockDeviceLanguageTag.mockReturnValue("es-MX");
		await appState.emit("active");

		expect(first.result.current).toBe("es-MX");
		expect(second.result.current).toBe("es-MX");
	});

	it("returns null rather than throwing when the platform call fails", async () => {
		watchAppState();
		mockDeviceLanguageTag.mockImplementation(() => {
			throw new Error("boom");
		});

		const { result } = await renderHook(() => useDeviceLanguageTag());

		expect(result.current).toBeNull();
	});

	it("removes its AppState subscription on unmount", async () => {
		const appState = watchAppState();
		mockDeviceLanguageTag.mockReturnValue("en-US");

		const { unmount } = await renderHook(() => useDeviceLanguageTag());
		await act(async () => {
			unmount();
		});

		expect(appState.remove).toHaveBeenCalled();
	});
});
