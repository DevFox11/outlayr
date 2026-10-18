import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

import { AMOUNT_HERO_MAX_SIZE, amountHeroFontSize } from "@/domain/amount-hero-size";
import { amountParts, currencySymbol, formatAmount, symbolPrefix } from "@/domain/money";
import type { Language } from "@/i18n/languages";

import {
    AmountsHiddenContext,
    DayTotal,
    fittedHeroSize,
    FlowAmount,
    HeroNumber,
    MeasureCellAmount,
} from "./amount-text";
import { FontScaleCapContext } from "./text";

let mockLanguage: Language = "en";

jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: mockLanguage, setLanguage: jest.fn() }),
    useTranslation: () => (key: string) => key,
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

const AX3_FONT_SCALE = 2.643;

describe("fittedHeroSize", () => {
    it("fits the figure Dynamic Type draws, not the one it is asked for", () => {
        const width = 400;
        const amount = 123_456.78;
        const drawn = fittedHeroSize(40, amount, 2, width, AX3_FONT_SCALE) * AX3_FONT_SCALE;

        expect(drawn).toBeLessThanOrEqual(amountHeroFontSize(amount, 2, width));
        expect(fittedHeroSize(40, 5137.55, 2, width, AX3_FONT_SCALE) * AX3_FONT_SCALE).toBeLessThanOrEqual(
            AMOUNT_HERO_MAX_SIZE
        );
    });

    it("leaves an unscaled figure where it was", () => {
        expect(fittedHeroSize(40, 5137.55, 2, 272, 1)).toBe(40);
        expect(fittedHeroSize(40, 453_333_333, 2, 353, 1)).toBe(Math.floor(amountHeroFontSize(453_333_333, 2, 353)));
    });
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
                    prefix={`+${symbolPrefix(currencySymbol(code))}`}
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

describe("amounts shown again after hiding", () => {
    it("labels the day total and the cell with the figure on screen, not the hidden label", async () => {
        const ui = (hidden: boolean) => (
            <AmountsHiddenContext value={hidden}>
                <DayTotal totals={[{ amount: -12.5, currencyCode: "USD", transactionCount: 1 }]} />
                <MeasureCellAmount code="USD" income magnitude={40} positive />
            </AmountsHiddenContext>
        );
        await render(ui(true));
        await screen.rerender(ui(false));

        expect(screen.getByText("-$12.50").props.accessibilityLabel).toBe("-$12.50");
        expect(screen.getByText("+$40.00").props.accessibilityLabel).toBe("+$40.00");
    });
});
