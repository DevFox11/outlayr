import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import type { Plan, PlanKind } from "@/domain/pro-plans";
import { testMaterialColors as mockTestMaterialColors } from "@/theme/test-colors";

import { StoreTerms } from "./store-terms";

const mockManagementUrl = jest.fn<() => Promise<string | null>>();

jest.mock<typeof import("@/theme/use-material-colors")>("@/theme/use-material-colors", () => ({
    useMaterialColors: () => mockTestMaterialColors(),
}));
jest.mock("@/lib/revenuecat", () => ({
    managementUrl: () => mockManagementUrl(),
    onCustomerInfoUpdated: () => () => undefined,
}));
jest.mock("@/contexts/revenuecat-context", () => ({
    useRevenueCat: () => ({ isConfigured: true }),
}));

function plan(kind: PlanKind, trialDays: number | null = null): Plan {
    return {
        kind,
        // SAFETY: the terms read only the plan's kind and trial; the package is never touched.
        offer: {} as PurchasesPackage,
        perMonth: null,
        priceString: "$39.99",
        savingsPercent: null,
        trialDays,
    };
}

describe("storeTerms on Android", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        mockManagementUrl.mockReset();
    });

    it("states Play's renewal terms under a subscription, and the trial's conversion when it has one", async () => {
        mockManagementUrl.mockResolvedValue(null);
        await render(<StoreTerms plan={plan("annual")} />);
        expect(screen.getByText("pro.play.renews")).toBeOnTheScreen();

        await render(<StoreTerms plan={plan("annual", 7)} />);
        expect(screen.getByText("pro.play.trial pro.play.renews")).toBeOnTheScreen();
    });

    it("leaves them out for the one-time lifetime purchase, and with nothing to buy", async () => {
        mockManagementUrl.mockResolvedValue(null);
        await render(<StoreTerms plan={plan("lifetime")} />);
        expect(screen.queryByText(/pro\.play\.renews/)).toBeNull();

        await render(<StoreTerms plan={null} />);
        expect(screen.queryByText(/pro\.play\.renews/)).toBeNull();
    });

    it("manages the subscription where the store that owns it says", async () => {
        const url = "https://apps.apple.com/account/subscriptions";
        mockManagementUrl.mockResolvedValue(url);
        const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
        await render(<StoreTerms plan={null} />);

        await fireEvent.press(await screen.findByRole("link", { name: "pro.play.manage" }));

        expect(openURL).toHaveBeenCalledWith(url);
    });

    it("hides the link when there is nothing to manage", async () => {
        mockManagementUrl.mockResolvedValue(null);
        await render(<StoreTerms plan={plan("monthly")} />);

        await screen.findByText("pro.play.renews");
        expect(screen.queryByRole("link", { name: "pro.play.manage" })).toBeNull();
    });
});
