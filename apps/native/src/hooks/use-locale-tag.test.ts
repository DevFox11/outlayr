import { describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

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

    it("returns undefined when the tag is whitespace-only", async () => {
        mockUseDeviceLanguageTag.mockReturnValue("   ");
        const { result } = await renderHook(() => useLocaleTag());
        expect(result.current).toBeUndefined();
    });
});
