import { isMissingCategory, TRANSACTION_FORM_ERROR, transactionFormErrors } from "./transaction-form-validate";

const CATEGORY = { id: "cat_1" };
const PENDING = { name: "Coffee" };

describe("transactionFormErrors", () => {
	it("returns null when the amount is positive and a category is chosen", () => {
		expect(
			transactionFormErrors({
				amount: "1200",
				category: CATEGORY,
				pendingCategory: null,
			})
		).toBeNull();
	});

	it("accepts a pending category in place of a saved one", () => {
		expect(
			transactionFormErrors({
				amount: "1200",
				category: null,
				pendingCategory: PENDING,
			})
		).toBeNull();
	});

	it("flags an empty amount", () => {
		expect(
			transactionFormErrors({
				amount: "",
				category: CATEGORY,
				pendingCategory: null,
			})
		).toEqual({ fields: { amount: TRANSACTION_FORM_ERROR.amountRequired } });
	});

	it("flags a zero amount", () => {
		expect(
			transactionFormErrors({
				amount: "0",
				category: CATEGORY,
				pendingCategory: null,
			})
		).toEqual({ fields: { amount: TRANSACTION_FORM_ERROR.amountRequired } });
	});

	it("flags a missing category", () => {
		expect(
			transactionFormErrors({
				amount: "1200",
				category: null,
				pendingCategory: null,
			})
		).toEqual({
			fields: { category: TRANSACTION_FORM_ERROR.categoryRequired },
		});
	});

	it("flags both when the entry is empty", () => {
		expect(
			transactionFormErrors({
				amount: "",
				category: null,
				pendingCategory: null,
			})
		).toEqual({
			fields: {
				amount: TRANSACTION_FORM_ERROR.amountRequired,
				category: TRANSACTION_FORM_ERROR.categoryRequired,
			},
		});
	});
});

describe("isMissingCategory", () => {
	it("is true only when the category is the failing rule", () => {
		expect(isMissingCategory({ category: null, pendingCategory: null })).toBe(true);
		expect(isMissingCategory({ category: CATEGORY, pendingCategory: null })).toBe(false);
		expect(isMissingCategory({ category: null, pendingCategory: PENDING })).toBe(false);
	});
});
