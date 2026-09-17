import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { useImperativeHandle as mockUseImperativeHandle } from "react";
import type { Ref } from "react";

import type { ImportSheetHandle } from "@/components/import-sheet/import-sheet";
import {
    testAppSettings as mockTestAppSettings,
    testDisplaySettingsValue as mockTestDisplaySettingsValue,
} from "@/contexts/test-settings";
import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { Settings } from "./index";

/**
 * The screen pulls a dozen hooks; every one is stubbed to its resting value
 * so the rows under test render and nothing else runs. What is asserted is
 * what a tap on a data-section row does, not how the screen looks.
 */
jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));
jest.mock("@/contexts/display-settings-context", () => ({
    useAppSettings: () => mockTestAppSettings(),
    useDisplaySettings: () => mockTestDisplaySettingsValue(),
}));
jest.mock("@/contexts/revenuecat-context", () => ({ useRevenueCat: () => ({ isPro: false }) }));
jest.mock("@/data/app-meta", () => ({ useGlobalCurrency: () => "USD" }));
jest.mock("@/data/use-sync-status", () => ({ useSyncStatus: () => ({ pending: 0, syncedAt: null }) }));
jest.mock("@/data/use-valuation-coverage", () => ({
    useValuationCoverage: () => ({ beyondRateHistory: 0, converted: 0, pending: 0 }),
}));
jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string) => key,
}));
jest.mock("@/lib/reminder-sync", () => ({ useReminderSync: () => {} }));
jest.mock("@/lib/app-icon", () => ({
    alternateIconsSupported: () => false,
    useAppIcon: () => ({ active: null, choose: () => {} }),
}));
jest.mock("@/components/settings/account-row", () => ({ AccountRow: () => null }));
jest.mock("@/components/settings/usage-row", () => ({ UsageRow: () => null }));

const mockPresent = jest.fn();
jest.mock("@/components/import-sheet/import-sheet", () => ({
    ImportSheet: ({ ref }: { ref: Ref<ImportSheetHandle> }) => {
        mockUseImperativeHandle(ref, () => ({ dismiss: () => {}, present: mockPresent }));
        return null;
    },
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockSetStep = jest.fn();
const mockGetResumeStep = jest.fn<() => string>();
jest.mock("@/lib/import-draft-store", () => ({
    importDraftStore: {
        getResumeStep: () => mockGetResumeStep(),
        setStep: (step: string) => mockSetStep(step),
    },
}));

beforeEach(() => {
    mockPresent.mockClear();
    mockPush.mockClear();
    mockSetStep.mockClear();
    mockGetResumeStep.mockReset();
});

describe("settings screen: data section rows", () => {
    it("pushes the restore screen from the restore row", async () => {
        const { getByText } = await render(<Settings />);

        fireEvent.press(getByText("settings.row.restore"));

        expect(mockPush).toHaveBeenCalledWith("/settings/restore");
    });

    it("presents the import sheet from the import row, seeded with the resume step, without routing", async () => {
        // A value the handler cannot know on its own: only the getter can supply it.
        mockGetResumeStep.mockReturnValue("mapping");
        const { getByText } = await render(<Settings />);

        fireEvent.press(getByText("settings.row.import"));

        expect(mockGetResumeStep).toHaveBeenCalledTimes(1);
        expect(mockSetStep).toHaveBeenCalledWith("mapping");
        expect(mockPresent).toHaveBeenCalledTimes(1);
        expect(mockPush).not.toHaveBeenCalled();
    });
});
