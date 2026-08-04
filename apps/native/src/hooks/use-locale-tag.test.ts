import { renderHook } from "@testing-library/react-native";

jest.mock("@/i18n/language-storage", () => ({
	deviceLanguageTag: jest.fn(),
}));

import { deviceLanguageTag } from "@/i18n/language-storage";
import { useLocaleTag } from "./use-locale-tag";

const mockDeviceLanguageTag = deviceLanguageTag as jest.Mock;

describe("useLocaleTag", () => {
	it("returns the device's own language tag", async () => {
		mockDeviceLanguageTag.mockReturnValue("es-VE");
		const { result } = await renderHook(() => useLocaleTag());
		expect(result.current).toBe("es-VE");
	});

	it("returns undefined, never null, when the device reports no tag", async () => {
		mockDeviceLanguageTag.mockReturnValue(null);
		const { result } = await renderHook(() => useLocaleTag());
		expect(result.current).toBeUndefined();
	});

	it("returns undefined, never an empty string, when the tag is empty", async () => {
		mockDeviceLanguageTag.mockReturnValue("");
		const { result } = await renderHook(() => useLocaleTag());
		expect(result.current).toBeUndefined();
	});

	it("returns undefined when the tag is whitespace-only", async () => {
		mockDeviceLanguageTag.mockReturnValue("   ");
		const { result } = await renderHook(() => useLocaleTag());
		expect(result.current).toBeUndefined();
	});

	it("returns undefined rather than throwing when the underlying call throws", async () => {
		mockDeviceLanguageTag.mockImplementation(() => {
			throw new Error("boom");
		});
		const { result } = await renderHook(() => useLocaleTag());
		expect(result.current).toBeUndefined();
	});
});
