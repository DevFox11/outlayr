import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

import { amountParts, currencySymbol, formatAmount } from "@/domain/money";
import type { Language } from "@/i18n/languages";

import { FlowAmount, HeroNumber } from "./amount-text";
import { FontScaleCapContext } from "./text";

let mockLanguage: Language = "en";

jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: mockLanguage, setLanguage: jest.fn() }),
}));
jest.mock("@/i18n/device-language", () => ({
    ...jest.requireActual<typeof import("@/i18n/device-language")>("@/i18n/device-language"),
    firstLocale: () => ({ decimalSeparator: ",", digitGroupingSeparator: ".", regionCode: "AR" }),
}));

const CASES: [Language, number, string, boolean][] = [
    ["en", 1240.5, "USD", true],
    ["en", 1240.5, "USD", false],
    ["en", 98_765, "JPY", true],
    ["en", 12.3456, "KWD", true],
    ["es", 1_234_567.891, "USD", true],
    ["es", -7.05, "EUR", true],
];

beforeEach(() => {
    mockLanguage = "en";
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("heroNumber", () => {
    it.each(CASES)(
        "prints %s %d %s (cents: %s) as the static figure did",
        async (language, amount, code, showCents) => {
            mockLanguage = language;
            const parts = amountParts(amount, code, showCents, language);
            const sign = amount < 0 ? "-" : "+";
            await render(<HeroNumber amount={amount} code={code} showCents={showCents} />);

            expect(
                screen.getByLabelText(`${sign}${formatAmount(amount, code, showCents, language)}`)
            ).toBeOnTheScreen();
            expect(screen.getByText(`${sign}${parts.symbol}`)).toBeOnTheScreen();
            expect(screen.getByText(parts.integer)).toBeOnTheScreen();
            expect(parts.fraction === "" || screen.getByText(`${parts.locale.decimal}${parts.fraction}`)).toBeTruthy();
        }
    );
});

describe("flowAmount", () => {
    it.each(CASES)(
        "prints %s %d %s (cents: %s) as the static figure did",
        async (language, amount, code, showCents) => {
            mockLanguage = language;
            await render(
                <FlowAmount
                    amount={Math.abs(amount)}
                    code={code}
                    prefix={`+${currencySymbol(code)}`}
                    showCents={showCents}
                />
            );

            expect(screen.getByText(`+${formatAmount(amount, code, showCents, language)}`)).toBeOnTheScreen();
        }
    );
});

describe("flowFigure under a font scale cap", () => {
    it("stops the animated digits growing where the text around them stops", async () => {
        jest.spyOn(Dimensions, "get").mockReturnValue({ fontScale: 2.7, height: 956, scale: 3, width: 440 });
        await render(
            <FontScaleCapContext value={1.35}>
                <FlowAmount amount={17.5} code="USD" showCents size={34} />
            </FontScaleCapContext>
        );

        expect(StyleSheet.flatten(screen.getByText("17.50").props.style).fontSize).toBeCloseTo(17);
    });
});
