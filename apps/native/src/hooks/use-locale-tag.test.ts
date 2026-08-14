import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

jest.mock<Partial<typeof import("@/i18n/device-language")>>("@/i18n/device-language", () => ({
    useDeviceLanguageTag: jest.fn<typeof import("@/i18n/device-language").useDeviceLanguageTag>(),
}));

import { useDeviceLanguageTag } from "@/i18n/device-language";

import { useLocaleTag } from "./use-locale-tag";

const mockUseDeviceLanguageTag = jest.mocked(useDeviceLanguageTag);

describe("useLocaleTag", () => {
    it("returns the device's own language tag", async () => {
        mockUseDeviceLanguageTag.mockReturnValue("es-VE");
        const { result } = await renderHook(() => useLocaleTag());
        expect(result.current).toBe("es-VE");
    });

    it("returns undefined, never null, when the device reports no tag", async () => {
        mockUseDeviceLanguageTag.mockReturnValue(null);
        const { result } = await renderHook(() => useLocaleTag());
        expect(result.current).toBeUndefined();
    });

    it("returns undefined, never an empty string, when the tag is empty", async () => {
        mockUseDeviceLanguageTag.mockReturnValue("");
        const { result } = await renderHook(() => useLocaleTag());
        expect(result.current).toBeUndefined();
    });

    it("returns undefined when the tag is whitespace-only", async () => {
        mockUseDeviceLanguageTag.mockReturnValue("   ");
        const { result } = await renderHook(() => useLocaleTag());
        expect(result.current).toBeUndefined();
    });

    it("follows the tag when the device language changes", async () => {
        mockUseDeviceLanguageTag.mockReturnValue("en-US");
        const { result, rerender } = await renderHook(() => useLocaleTag());
        expect(result.current).toBe("en-US");

        mockUseDeviceLanguageTag.mockReturnValue("fr-FR");
        await act(async () => {
            rerender({});
        });

        expect(result.current).toBe("fr-FR");
    });
});
