import { renderHook } from "@testing-library/react-native";

jest.mock("expo-localization", () => ({
	getLocales: jest.fn(),
}));

import { getLocales } from "expo-localization";
import { useRegionCode } from "./use-region-code";

const mockGetLocales = getLocales as jest.Mock;

describe("useRegionCode", () => {
	it("returns the device's own region code", async () => {
		mockGetLocales.mockReturnValue([{ regionCode: "VE" }]);
		const { result } = await renderHook(() => useRegionCode());
		expect(result.current).toBe("VE");
	});

	it("returns undefined, never null, when the device reports no region", async () => {
		mockGetLocales.mockReturnValue([{ regionCode: null }]);
		const { result } = await renderHook(() => useRegionCode());
		expect(result.current).toBeUndefined();
	});

	it("returns undefined, never an empty string, when the region is empty", async () => {
		mockGetLocales.mockReturnValue([{ regionCode: "" }]);
		const { result } = await renderHook(() => useRegionCode());
		expect(result.current).toBeUndefined();
	});

	it("returns undefined when getLocales reports no entries", async () => {
		mockGetLocales.mockReturnValue([]);
		const { result } = await renderHook(() => useRegionCode());
		expect(result.current).toBeUndefined();
	});

	it("returns undefined rather than throwing when the underlying call throws", async () => {
		mockGetLocales.mockImplementation(() => {
			throw new Error("boom");
		});
		const { result } = await renderHook(() => useRegionCode());
		expect(result.current).toBeUndefined();
	});
});
