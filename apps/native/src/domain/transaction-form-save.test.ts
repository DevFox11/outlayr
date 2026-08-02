import { RECURRING_TYPE } from "./recurrence";
import {
	buildTransactionInput,
	type TransactionSaveDraft,
} from "./transaction-form-save";

const BASE: TransactionSaveDraft = {
	amount: 1250,
	income: false,
	categoryId: "cat-1",
	note: "Coffee",
	details: "",
	date: new Date(2026, 2, 10),
	currency: "USD",
	icon: "cup.and.saucer",
	emoji: null,
	customColor: null,
	imageUri: null,
	imageColor: null,
	isSubscription: false,
	recurringType: RECURRING_TYPE.weekly,
	coefficient: 3,
	hasEndDate: true,
	endDate: new Date(2026, 5, 10),
	leadDays: 2,
};

describe("buildTransactionInput", () => {
	it("carries the plain fields through untouched", () => {
		const input = buildTransactionInput(BASE);
		expect(input.amount).toBe(1250);
		expect(input.income).toBe(false);
		expect(input.categoryId).toBe("cat-1");
		expect(input.note).toBe("Coffee");
		expect(input.details).toBe("");
		expect(input.date).toBe(BASE.date);
		expect(input.currency).toBe("USD");
		expect(input.icon).toBe("cup.and.saucer");
		expect(input.emoji).toBe(null);
		expect(input.customColor).toBe(null);
		expect(input.imageUri).toBe(null);
		expect(input.imageColor).toBe(null);
	});

	it("strips every schedule field for a one-off, regardless of the leftover cadence state", () => {
		const input = buildTransactionInput(BASE);
		expect(input.onceRecurring).toBe(false);
		expect(input.recurringType).toBe(RECURRING_TYPE.none);
		expect(input.recurringCoefficient).toBe(1);
		expect(input.recurringEndDate).toBe(null);
		expect(input.reminderLeadDays).toBe(null);
	});

	it("carries the cadence, coefficient, end date and lead through for a subscription", () => {
		const input = buildTransactionInput({ ...BASE, isSubscription: true });
		expect(input.onceRecurring).toBe(true);
		expect(input.recurringType).toBe(RECURRING_TYPE.weekly);
		expect(input.recurringCoefficient).toBe(3);
		expect(input.recurringEndDate).toBe(BASE.endDate);
		expect(input.reminderLeadDays).toBe(2);
	});

	it("drops the end date for a subscription that has none, even with an endDate value staged", () => {
		const input = buildTransactionInput({
			...BASE,
			isSubscription: true,
			hasEndDate: false,
		});
		expect(input.recurringEndDate).toBe(null);
	});

	it("clamps the coefficient to at least 1", () => {
		expect(
			buildTransactionInput({ ...BASE, isSubscription: true, coefficient: 0 })
				.recurringCoefficient,
		).toBe(1);
		expect(
			buildTransactionInput({ ...BASE, isSubscription: true, coefficient: -5 })
				.recurringCoefficient,
		).toBe(1);
	});

	it("passes a null lead through for a subscription with reminders off", () => {
		const input = buildTransactionInput({
			...BASE,
			isSubscription: true,
			leadDays: null,
		});
		expect(input.reminderLeadDays).toBe(null);
	});
});
