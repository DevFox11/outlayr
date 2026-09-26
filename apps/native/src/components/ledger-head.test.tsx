import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { LedgerHead } from "./ledger-head";

jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en", setLanguage: jest.fn() }),
    useTranslation: () => (key: string) => key,
}));
jest.mock("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => ({ state: { showCents: true } }),
}));

describe("ledgerHead", () => {
    it("names each cell by its label and signed figure only", async () => {
        await render(
            <LedgerHead
                cells={[
                    { income: true, label: "IN", magnitude: 6650, onPress: jest.fn(), positive: true },
                    {
                        income: false,
                        label: "OUT",
                        magnitude: 2883.41,
                        onPress: jest.fn(),
                        positive: false,
                    },
                ]}
                code="USD"
            />
        );

        expect(screen.getByRole("button", { name: "IN, +$6,650.00" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "OUT, -$2,883.41" })).toBeTruthy();
    });
});
