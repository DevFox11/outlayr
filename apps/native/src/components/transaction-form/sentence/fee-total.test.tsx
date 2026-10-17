import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import type { TranslationParams } from "@/i18n/translate";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { FeeTotal } from "./fee-total";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

jest.mock("@/i18n/context", () => {
    const { interpolate } = jest.requireActual<typeof import("@/i18n/translate")>("@/i18n/translate");
    const copy: Record<string, string> = {
        "transaction.fee.line": "{base} plus {fee}",
        "transaction.fee.part": "{fee} in fees",
        "transaction.fee.pays": "{account} pays",
        "transaction.fee.total": "Total with fee",
    };
    return {
        useLanguage: () => ({ language: "en", setLanguage: jest.fn() }),
        useTranslation: () => (key: string, params?: TranslationParams) => interpolate(copy[key] ?? key, params),
    };
});

const renderTotal = (account: string | null, onPress = jest.fn()) =>
    render(<FeeTotal account={account} base={24.07} code="USD" fee={0.84} onPress={onPress} />);

describe("feeTotal", () => {
    it("names who pays the total and reads the math as its value", async () => {
        await renderTotal("Payoneer");

        const total = screen.getByRole("button", { name: "Payoneer pays $24.91" });
        expect(total.props.accessibilityValue.text).toBe("$24.07 plus $0.84 in fees");
    });

    it("labels the total on its own when no account is set", async () => {
        await renderTotal(null);

        expect(screen.getByRole("button", { name: "Total with fee $24.91" })).toBeOnTheScreen();
    });
});
