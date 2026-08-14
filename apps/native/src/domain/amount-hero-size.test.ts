import { AMOUNT_HERO_MAX_SIZE, AMOUNT_HERO_MIN_SIZE, amountHeroFontSize, amountHeroLength } from "./amount-hero-size";

const IPHONE_CONTENT_WIDTH = 353;

describe("amountHeroLength", () => {
    it("counts the decimal point and the fraction", () => {
        expect(amountHeroLength(0, 2)).toBe(4);
    });

    it("omits the fraction for a zero-minor-unit currency", () => {
        expect(amountHeroLength(1234, 0)).toBe(5);
    });

    it("counts one separator per group of three", () => {
        expect(amountHeroLength(4500, 2)).toBe(8);
        expect(amountHeroLength(453_333_333, 2)).toBe(14);
    });

    it("measures the magnitude, so a negative is the same width", () => {
        expect(amountHeroLength(-4500, 2)).toBe(amountHeroLength(4500, 2));
    });
});

describe("amountHeroFontSize", () => {
    it("leaves a short figure at full size", () => {
        expect(amountHeroFontSize(0, 2, IPHONE_CONTENT_WIDTH)).toBe(AMOUNT_HERO_MAX_SIZE);
        expect(amountHeroFontSize(450, 2, IPHONE_CONTENT_WIDTH)).toBe(AMOUNT_HERO_MAX_SIZE);
    });

    // The reported bug: 453,333,333.00 ran off both edges at a fixed 62pt.
    it("shrinks a figure that would overflow", () => {
        const size = amountHeroFontSize(453_333_333, 2, IPHONE_CONTENT_WIDTH);
        expect(size).toBeLessThan(AMOUNT_HERO_MAX_SIZE);
        expect(size * amountHeroLength(453_333_333, 2) * 0.58).toBeLessThanOrEqual(IPHONE_CONTENT_WIDTH);
    });

    it("keeps shrinking as the figure keeps growing", () => {
        const nine = amountHeroFontSize(453_333_333, 2, IPHONE_CONTENT_WIDTH);
        const twelve = amountHeroFontSize(453_333_333_000, 2, IPHONE_CONTENT_WIDTH);
        expect(twelve).toBeLessThan(nine);
    });

    it("never goes below the floor", () => {
        expect(amountHeroFontSize(Number.MAX_SAFE_INTEGER, 2, IPHONE_CONTENT_WIDTH)).toBe(AMOUNT_HERO_MIN_SIZE);
    });

    it("shrinks sooner on a narrower screen", () => {
        const wide = amountHeroFontSize(4_500_000, 2, IPHONE_CONTENT_WIDTH);
        const narrow = amountHeroFontSize(4_500_000, 2, 280);
        expect(narrow).toBeLessThan(wide);
    });

    // A zero or negative content width means layout has not reported yet.
    it("falls back to the floor before the width is known", () => {
        expect(amountHeroFontSize(4500, 2, 0)).toBe(AMOUNT_HERO_MIN_SIZE);
    });
});
