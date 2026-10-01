import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

import { useAnalyticsConsent } from "./posthog-consent";

const mockState: { db: object | null; share: boolean } = { db: null, share: true };
const mockOptIn = jest.fn(async () => undefined);
const mockOptOut = jest.fn(async () => undefined);

jest.mock("@/contexts/local-data-context", () => ({ useLocalData: () => ({ db: mockState.db }) }));
jest.mock("@/data/settings", () => ({ useBoolSetting: () => mockState.share }));
jest.mock("@/lib/posthog", () => ({
    posthog: { optIn: () => mockOptIn(), optOut: () => mockOptOut() },
}));

beforeEach(() => {
    mockOptIn.mockClear();
    mockOptOut.mockClear();
    mockState.db = null;
    mockState.share = true;
});

describe("useAnalyticsConsent", () => {
    it("leaves the SDK's persisted choice alone until the database is open", async () => {
        await renderHook(useAnalyticsConsent);
        expect(mockOptIn).not.toHaveBeenCalled();
        expect(mockOptOut).not.toHaveBeenCalled();
    });

    it("opts out once the stored setting is off", async () => {
        mockState.share = false;
        const { rerender } = await renderHook(useAnalyticsConsent);
        mockState.db = {};
        await rerender(undefined);
        expect(mockOptOut).toHaveBeenCalledTimes(1);
        expect(mockOptIn).not.toHaveBeenCalled();
    });

    it("opts back in when the setting turns on", async () => {
        mockState.db = {};
        mockState.share = false;
        const { rerender } = await renderHook(useAnalyticsConsent);
        mockState.share = true;
        await rerender(undefined);
        expect(mockOptIn).toHaveBeenCalledTimes(1);
    });
});
