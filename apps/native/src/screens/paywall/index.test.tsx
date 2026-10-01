import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { PurchasesPackage } from "react-native-purchases";

import type { PurchaseOutcome } from "@/contexts/revenuecat-context";

import { Paywall } from "./index";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string, params?: Record<string, string | number>) =>
        params ? `${key}:${Object.values(params).join(",")}` : key,
}));

const mockRevenueCat = {
    eligibleForTrial: jest.fn<(ids: readonly string[]) => Promise<ReadonlySet<string>>>(),
    getPackages: jest.fn<() => Promise<PurchasesPackage[]>>(),
    isMirrored: false,
    isPro: false,
    isResolved: true,
    mirrorEntitlement: jest.fn<() => Promise<boolean>>(() => mockCloudAction("revenuecat:syncFromStore", {})),
    purchasePackage: jest.fn<(offer: PurchasesPackage) => Promise<PurchaseOutcome>>(),
    restorePurchases: jest.fn<() => Promise<boolean>>(),
};
jest.mock("@/contexts/revenuecat-context", () => ({ useRevenueCat: () => mockRevenueCat }));

function planCard(kind: string) {
    return screen.getByRole("radio", { name: new RegExp(`pro\\.plan\\.${kind}`) });
}

function noPlanCard(kind: string) {
    return screen.queryByRole("radio", { name: new RegExp(`pro\\.plan\\.${kind}`) });
}

const mockSession: { accountId: string | null } = { accountId: "user-1" };
jest.mock<Partial<typeof import("@/lib/auth-session")>>("@/lib/auth-session", () => ({
    useAuthSession: () => ({
        accountId: mockSession.accountId,
        activate: () => undefined,
        begin: () => undefined,
        gate: "signed-in",
        reject: () => undefined,
    }),
}));

const mockCloudAction = jest.fn<(path: string, args: unknown) => Promise<boolean>>(async () => true);
const cloud: { runtime: object | null } = { runtime: {} };
jest.mock("@/lib/convex", () => ({
    cloudAction: (path: string, args: unknown) => mockCloudAction(path, args),
    get convex() {
        return cloud.runtime;
    },
}));

function offer(type: string, price: number, trial: boolean): PurchasesPackage {
    // SAFETY: the screen reads only the fields `readPlans` reads.
    return {
        identifier: type,
        packageType: type,
        product: {
            identifier: type,
            introPrice: trial ? { periodNumberOfUnits: 7, periodUnit: "DAY", price: 0 } : null,
            price,
            pricePerMonthString: type === "ANNUAL" ? "$4.17" : null,
            priceString: `$${price.toFixed(2)}`,
        },
    } as unknown as PurchasesPackage;
}

const ANNUAL = offer("ANNUAL", 49.99, true);
const MONTHLY = offer("MONTHLY", 7.99, false);

beforeEach(() => {
    jest.clearAllMocks();
    mockRevenueCat.isPro = false;
    mockRevenueCat.isMirrored = true;
    mockRevenueCat.getPackages.mockResolvedValue([ANNUAL, MONTHLY]);
    mockRevenueCat.eligibleForTrial.mockResolvedValue(new Set(["ANNUAL", "MONTHLY", "LIFETIME"]));
    mockRevenueCat.purchasePackage.mockResolvedValue("pro");
    mockRevenueCat.restorePurchases.mockResolvedValue(true);
    mockCloudAction.mockResolvedValue(true);
    mockSession.accountId = "user-1";
    cloud.runtime = {};
});

describe("paywall", () => {
    it("opens on the yearly plan and names its trial in the button", async () => {
        await render(<Paywall />);

        await waitFor(() => expect(planCard("annual")).toBeTruthy());
        expect(planCard("annual").props.accessibilityState.selected).toBe(true);
        expect(screen.getByTestId("paywall-cta")).toHaveTextContent("pro.cta.start:7");
    });

    it("names the plan's price on the button when it has no trial", async () => {
        await render(<Paywall />);
        await waitFor(() => expect(planCard("monthly")).toBeTruthy());

        await fireEvent.press(planCard("monthly"));

        expect(planCard("monthly").props.accessibilityState.selected).toBe(true);
        expect(screen.getByTestId("paywall-cta")).toHaveTextContent("pro.cta.buyMonthly:$7.99");
    });

    it("buys the selected plan, not the one the sheet opened on", async () => {
        await render(<Paywall />);
        await waitFor(() => expect(planCard("monthly")).toBeTruthy());

        await fireEvent.press(planCard("monthly"));
        await fireEvent.press(screen.getByTestId("paywall-cta"));

        await waitFor(() => expect(mockRevenueCat.purchasePackage).toHaveBeenCalledWith(MONTHLY));
        await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    });

    it("stays open when the purchase was cancelled rather than granted", async () => {
        mockRevenueCat.purchasePackage.mockResolvedValue("cancelled");
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-cta")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-cta"));

        await waitFor(() => expect(mockRevenueCat.purchasePackage).toHaveBeenCalledTimes(1));
        expect(mockBack).not.toHaveBeenCalled();
        expect(screen.queryByTestId("paywall-failure")).toBeNull();
    });

    it("mirrors the entitlement to the backend before it closes, so a retry is not still gated", async () => {
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-cta")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-cta"));

        await waitFor(() => expect(mockRevenueCat.mirrorEntitlement).toHaveBeenCalledTimes(1));
        expect(mockRevenueCat.mirrorEntitlement.mock.invocationCallOrder[0]).toBeLessThan(
            mockBack.mock.invocationCallOrder[0]
        );
    });

    it("names the restore when its own confirmation has not landed", async () => {
        mockCloudAction.mockResolvedValue(false);
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-restore")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-restore"));

        await waitFor(() => expect(screen.getByTestId("paywall-failure")).toHaveTextContent("pro.restorePendingBody"));
        expect(mockBack).not.toHaveBeenCalled();
    });

    it("keeps the sheet open when the server has not confirmed the purchase", async () => {
        mockCloudAction.mockResolvedValue(false);
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-cta")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-cta"));

        await waitFor(() => expect(screen.getByTestId("paywall-failure")).toHaveTextContent("pro.syncPendingBody"));
        expect(mockBack).not.toHaveBeenCalled();
    });

    it("keeps the unconfirmed purchase visible even though the SDK already reports Pro", async () => {
        mockCloudAction.mockResolvedValue(false);
        mockRevenueCat.purchasePackage.mockImplementationOnce(async () => {
            mockRevenueCat.isPro = true;
            return "pro";
        });
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-cta")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-cta"));

        await waitFor(() => expect(screen.getByTestId("paywall-failure")).toHaveTextContent("pro.syncPendingBody"));
        expect(screen.queryByText("pro.alreadyActive")).toBeNull();
        expect(mockBack).not.toHaveBeenCalled();
    });

    it("asks a signed-out caller to sign in rather than selling under an anonymous id", async () => {
        mockSession.accountId = null;
        await render(<Paywall />);

        await waitFor(() => expect(screen.getByText("pro.needsAccount")).toBeTruthy());
        expect(screen.queryByTestId("paywall-cta")).toBeNull();
        expect(noPlanCard("annual")).toBeNull();
        expect(screen.queryByTestId("paywall-restore")).toBeNull();
    });

    it("does not mirror anything when the purchase was cancelled", async () => {
        mockRevenueCat.purchasePackage.mockResolvedValue("cancelled");
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-cta")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-cta"));

        await waitFor(() => expect(mockRevenueCat.purchasePackage).toHaveBeenCalledTimes(1));
        expect(mockCloudAction).not.toHaveBeenCalled();
    });

    it("names the restore, not a purchase, when the restore itself fails", async () => {
        mockRevenueCat.restorePurchases.mockRejectedValue(new Error("offline"));
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-restore")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-restore"));

        await waitFor(() => expect(screen.getByTestId("paywall-failure")).toHaveTextContent("pro.restoreFailedBody"));
    });

    it("says so when the store charged but Pro did not unlock", async () => {
        mockRevenueCat.purchasePackage.mockResolvedValue("unentitled");
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-cta")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-cta"));

        await waitFor(() => expect(screen.getByTestId("paywall-failure")).toHaveTextContent("pro.unentitledBody"));
        expect(mockBack).not.toHaveBeenCalled();
    });

    it("keeps the plans when only the eligibility lookup fails", async () => {
        mockRevenueCat.eligibleForTrial.mockRejectedValue(new Error("no receipt"));
        await render(<Paywall />);

        await waitFor(() => expect(planCard("annual")).toBeTruthy());
        expect(screen.queryByTestId("paywall-retry")).toBeNull();
        expect(screen.getByTestId("paywall-cta")).toHaveTextContent("pro.cta.buyYearly:$49.99");
    });

    it("states a failed purchase inside the sheet, where a toast cannot reach", async () => {
        mockRevenueCat.purchasePackage.mockRejectedValue(new Error("store down"));
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-cta")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-cta"));

        await waitFor(() => expect(screen.getByTestId("paywall-failure")).toHaveTextContent("pro.failedBody"));
        expect(mockBack).not.toHaveBeenCalled();
    });

    it("says so when a restore finds nothing, and closes when it finds something", async () => {
        mockRevenueCat.restorePurchases.mockResolvedValueOnce(false);
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-restore")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-restore"));
        await waitFor(() => expect(screen.getByTestId("paywall-failure")).toHaveTextContent("pro.nothingRestoredBody"));
        expect(mockBack).not.toHaveBeenCalled();

        await fireEvent.press(screen.getByTestId("paywall-restore"));
        await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    });

    it("offers a retry instead of a price when the offering is empty", async () => {
        mockRevenueCat.getPackages.mockResolvedValueOnce([]);
        await render(<Paywall />);

        await waitFor(() => expect(screen.getByTestId("paywall-retry")).toBeTruthy());
        expect(noPlanCard("annual")).toBeNull();

        await fireEvent.press(screen.getByTestId("paywall-retry"));

        await waitFor(() => expect(planCard("annual")).toBeTruthy());
    });

    it("claims no trial unless the store confirmed this customer is eligible", async () => {
        mockRevenueCat.eligibleForTrial.mockResolvedValue(new Set());
        await render(<Paywall />);

        await waitFor(() => expect(planCard("annual")).toBeTruthy());
        expect(screen.getByTestId("paywall-cta")).toHaveTextContent("pro.cta.buyYearly:$49.99");
        expect(screen.queryByText(/pro\.cta\.then/)).toBeNull();
    });

    it("does not promise a later charge on a plan that is charged now", async () => {
        await render(<Paywall />);
        await waitFor(() => expect(planCard("monthly")).toBeTruthy());
        expect(screen.queryByText(/pro\.cta\.then/)).toBeTruthy();

        await fireEvent.press(planCard("monthly"));

        expect(screen.queryByText(/pro\.cta\.then/)).toBeNull();
    });

    it("asks about eligibility for exactly the products the offering returned", async () => {
        await render(<Paywall />);

        await waitFor(() => expect(mockRevenueCat.eligibleForTrial).toHaveBeenCalledWith(["ANNUAL", "MONTHLY"]));
    });

    it("shows no way to buy again to a caller who is already Pro", async () => {
        mockRevenueCat.isPro = true;
        await render(<Paywall />);

        await waitFor(() => expect(mockRevenueCat.getPackages).toHaveBeenCalledTimes(1));
        expect(screen.getByText("pro.alreadyActive")).toBeTruthy();
        expect(screen.queryByTestId("paywall-cta")).toBeNull();
        expect(noPlanCard("annual")).toBeNull();
        expect(screen.queryByTestId("paywall-restore")).toBeTruthy();
    });

    it("does not call Pro active while the account has not been told about it", async () => {
        mockRevenueCat.isPro = true;
        mockRevenueCat.isMirrored = false;

        await render(<Paywall />);

        await waitFor(() => expect(screen.getByTestId("paywall-unconfirmed")).toBeTruthy());
        expect(screen.queryByText("pro.alreadyActive")).toBeNull();
    });

    it("offers to confirm an unmirrored entitlement, and says so when that fails", async () => {
        mockRevenueCat.isPro = true;
        mockRevenueCat.isMirrored = false;
        mockRevenueCat.mirrorEntitlement.mockResolvedValue(false);
        await render(<Paywall />);
        await waitFor(() => expect(screen.getByTestId("paywall-confirm")).toBeTruthy());

        await fireEvent.press(screen.getByTestId("paywall-confirm"));

        expect(mockRevenueCat.mirrorEntitlement).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("paywall-failure")).toHaveTextContent("pro.syncPendingBody");
    });

    it("keeps the one-payment note on the lifetime row while it is selected", async () => {
        mockRevenueCat.getPackages.mockResolvedValue([ANNUAL, MONTHLY, offer("LIFETIME", 129.99, false)]);
        await render(<Paywall />);
        await waitFor(() => expect(planCard("lifetime")).toBeTruthy());

        await fireEvent.press(planCard("lifetime"));

        expect(planCard("lifetime")).toHaveTextContent(/pro\.plan\.once/);
    });

    it("offers a retry when the offering could not be read at all", async () => {
        mockRevenueCat.getPackages.mockRejectedValueOnce(new Error("offline"));
        await render(<Paywall />);

        await waitFor(() => expect(screen.getByTestId("paywall-retry")).toBeTruthy());
    });

    it("sells nothing on a build whose Pro capabilities have no backend to run on", async () => {
        cloud.runtime = null;

        await render(<Paywall />);

        await waitFor(() => expect(screen.getByTestId("paywall-no-cloud")).toBeTruthy());
        expect(screen.queryByTestId("paywall-cta")).toBeNull();
        expect(noPlanCard("annual")).toBeNull();
    });
});
