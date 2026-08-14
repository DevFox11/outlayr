import { isMissingCategory, TRANSACTION_FORM_ERROR, transactionFormErrors } from "./transaction-form-validate";

const CATEGORY = { id: "cat_1" };
const PENDING = { name: "Coffee" };
const VALID_VALUES = {
    amount: "1200",
    category: CATEGORY,
    currency: "VES",
    exchangeRate: null,
    exchangeRateType: "official" as const,
    pendingCategory: null,
};

describe("transactionFormErrors", () => {
    it("returns null when the amount is positive and a category is chosen", () => {
        expect(transactionFormErrors(VALID_VALUES)).toBeNull();
    });

    it("accepts a pending category in place of a saved one", () => {
        expect(
            transactionFormErrors({
                ...VALID_VALUES,
                category: null,
                pendingCategory: PENDING,
            })
        ).toBeNull();
    });

    it("flags an empty amount", () => {
        expect(
            transactionFormErrors({
                ...VALID_VALUES,
                amount: "",
            })
        ).toEqual({ fields: { amount: TRANSACTION_FORM_ERROR.amountRequired } });
    });

    it("flags a zero amount", () => {
        expect(
            transactionFormErrors({
                ...VALID_VALUES,
                amount: "0",
            })
        ).toEqual({ fields: { amount: TRANSACTION_FORM_ERROR.amountRequired } });
    });

    it("flags a missing category", () => {
        expect(
            transactionFormErrors({
                ...VALID_VALUES,
                category: null,
            })
        ).toEqual({
            fields: { category: TRANSACTION_FORM_ERROR.categoryRequired },
        });
    });

    it("flags both when the entry is empty", () => {
        expect(
            transactionFormErrors({
                ...VALID_VALUES,
                amount: "",
                category: null,
            })
        ).toEqual({
            fields: {
                amount: TRANSACTION_FORM_ERROR.amountRequired,
                category: TRANSACTION_FORM_ERROR.categoryRequired,
            },
        });
    });

    it("accepts official without an entered actual rate", () => {
        expect(transactionFormErrors(VALID_VALUES)).toBeNull();
    });

    it("accepts EUR-reference only for VES", () => {
        expect(transactionFormErrors({ ...VALID_VALUES, exchangeRateType: "eur_reference" })).toBeNull();
        expect(
            transactionFormErrors({
                ...VALID_VALUES,
                currency: "EUR",
                exchangeRateType: "eur_reference",
            })
        ).toEqual({ fields: { exchangeRate: TRANSACTION_FORM_ERROR.eurReferenceRequiresVes } });
    });

    it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
        "rejects custom when the actual rate is blank zero negative or non-finite (%s)",
        (exchangeRate) => {
            expect(transactionFormErrors({ ...VALID_VALUES, exchangeRate, exchangeRateType: "custom" })).toEqual({
                fields: { exchangeRate: TRANSACTION_FORM_ERROR.customRateRequired },
            });
        }
    );

    it("accepts a finite positive custom actual rate", () => {
        expect(transactionFormErrors({ ...VALID_VALUES, exchangeRate: 55.5, exchangeRateType: "custom" })).toBeNull();
    });

    it("ignores all rate validation for USD", () => {
        expect(
            transactionFormErrors({
                ...VALID_VALUES,
                currency: "USD",
                exchangeRate: -1,
                exchangeRateType: "custom",
            })
        ).toBeNull();
    });
});

describe("isMissingCategory", () => {
    it("is true only when the category is the failing rule", () => {
        expect(isMissingCategory({ category: null, pendingCategory: null })).toBe(true);
        expect(isMissingCategory({ category: CATEGORY, pendingCategory: null })).toBe(false);
        expect(isMissingCategory({ category: null, pendingCategory: PENDING })).toBe(false);
    });
});
