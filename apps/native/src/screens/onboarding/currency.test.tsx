import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { OnboardingCurrency } from "./currency";

const mockPush = jest.fn();
/** The latest focus callback: calling it is the screen coming back into view. */
let mockRefocus: (() => void) | null = null;
jest.mock("expo-router", () => ({
    useFocusEffect: (callback: () => void) => {
        mockRefocus = callback;
    },
    useRouter: () => ({ push: mockPush }),
}));

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));
jest.mock("@/data/app-meta", () => ({ useGlobalCurrency: () => "USD" }));

const mockSetCurrency = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock<Partial<typeof import("@/data/settings-core")>>("@/data/settings-core", () => ({
    setCurrency: (...args: unknown[]) => mockSetCurrency(...args),
}));
jest.mock("@/components/currency-picker-sheet", () => ({ CurrencyPickerSheet: () => null }));

beforeEach(() => {
    mockPush.mockClear();
    mockSetCurrency.mockClear();
    mockRefocus = null;
});

describe("onboarding currency screen", () => {
    it("offers Continue again after going back from the next step", async () => {
        await render(<OnboardingCurrency />);

        fireEvent.press(screen.getByText("common.continue"));
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/smart-features"));
        // Held while smart features sits on top, so a second tap cannot push it twice.
        expect(screen.getByText("onboarding.currency.saving")).toBeTruthy();

        await act(() => mockRefocus?.());
        fireEvent.press(await screen.findByText("common.continue"));

        await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(2));
        expect(mockSetCurrency).toHaveBeenCalledTimes(2);
    });
});
