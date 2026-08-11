import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { TransactionFormRateSection } from "./rate-section";

jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		border: "#DAD6C9",
		danger: "#B5482F",
		foreground: "#17150F",
		income: "#3D7A5C",
		muted: "#8A8578",
		surface: "#FFFFFF",
		surfaceSecondary: "#F7F5EF",
	}),
}));

const labels = {
	currentSuggestion: "Current suggestion",
	custom: "Custom",
	editCustom: "Edit custom rate",
	eurReference: "EUR reference",
	official: "Official",
	pendingBody: "Native amount remains recorded. Cross-currency totals wait for confirmation.",
	pendingTitle: "Rate confirmation needed",
	perUsd: "VES per USD",
	priorCustomDate: (date: Date) => `Prior custom · ${date.toISOString().slice(0, 10)}`,
	priorCustomSuggestion: "Prior custom suggestion",
	required: "Enter a positive rate",
	requiredHint: "The rate must be greater than zero.",
	title: "Entry rate",
	useSuggestion: "Use suggestion",
};

const baseProps: ComponentProps<typeof TransactionFormRateSection> = {
	currency: "VES",
	error: null,
	labels,
	onEditCustom: jest.fn(),
	onSelectType: jest.fn(),
	onUseSuggestion: jest.fn(),
	pending: false,
	selection: { exchangeRate: null, exchangeRateType: "official" },
	suggestions: {
		eurReference: 50,
		official: 42,
		priorCustom: { date: new Date("2026-08-01T12:00:00.000Z"), rate: 55.5 },
	},
};

describe("TransactionFormRateSection", () => {
	it("renders no rate controls for USD", async () => {
		const { queryByText } = await render(<TransactionFormRateSection {...baseProps} currency="USD" />);

		expect(queryByText("Entry rate")).toBeNull();
	});

	it("offers Official and Custom for EUR and also EUR reference for VES", async () => {
		const withoutSuggestions = { eurReference: null, official: null, priorCustom: null };
		const eur = await render(
			<TransactionFormRateSection {...baseProps} currency="EUR" suggestions={withoutSuggestions} />
		);
		expect(eur.getByText("Official")).toBeTruthy();
		expect(eur.getByText("Custom")).toBeTruthy();
		expect(eur.queryByText("EUR reference")).toBeNull();

		const ves = await render(<TransactionFormRateSection {...baseProps} suggestions={withoutSuggestions} />);
		expect(ves.getByText("EUR reference")).toBeTruthy();
	});

	it("announces that a pending recurring custom occurrence needs confirmation", async () => {
		const { getByText } = await render(<TransactionFormRateSection {...baseProps} pending />);

		expect(getByText("Rate confirmation needed")).toBeTruthy();
		expect(getByText(labels.pendingBody).props.accessibilityLiveRegion).toBe("polite");
	});

	it("exposes each rate choice as a labelled button with selected state", async () => {
		const { getByRole } = await render(<TransactionFormRateSection {...baseProps} />);

		expect(getByRole("button", { name: "Official" }).props.accessibilityState).toEqual({ selected: true });
		expect(getByRole("button", { name: "Custom" }).props.accessibilityState).toEqual({ selected: false });
	});

	it("gives every rate-policy control at least a 44-point touch target", async () => {
		const { getByRole, getByLabelText } = await render(
			<TransactionFormRateSection {...baseProps} selection={{ exchangeRate: 55.5, exchangeRateType: "custom" }} />
		);
		const controls = [
			getByRole("button", { name: "Official" }),
			getByRole("button", { name: "EUR reference" }),
			getByRole("button", { name: "Custom" }),
			getByRole("button", { name: "Edit custom rate" }),
			getByLabelText("Current suggestion · Official. Use suggestion: 42 VES per USD"),
		];

		for (const control of controls) {
			expect(StyleSheet.flatten(control.props.style)?.minHeight).toBeGreaterThanOrEqual(44);
		}
	});

	it("shows current official EUR-reference and prior-custom suggestions without selecting them", async () => {
		const onUseSuggestion = jest.fn();
		const { getByText, getByRole } = await render(
			<TransactionFormRateSection {...baseProps} onUseSuggestion={onUseSuggestion} />
		);

		expect(getByText("42 VES per USD")).toBeTruthy();
		expect(getByText("50 VES per USD")).toBeTruthy();
		expect(getByText("55.5 VES per USD")).toBeTruthy();
		expect(getByRole("button", { name: "Custom" }).props.accessibilityState).toEqual({ selected: false });
		expect(onUseSuggestion).not.toHaveBeenCalled();
	});

	it("calls onUseSuggestion with the exact displayed actual rate only after a user press", async () => {
		const onUseSuggestion = jest.fn();
		const { getByLabelText } = await render(
			<TransactionFormRateSection {...baseProps} onUseSuggestion={onUseSuggestion} />
		);

		expect(onUseSuggestion).not.toHaveBeenCalled();
		await fireEvent.press(
			getByLabelText("Prior custom suggestion · Custom · Prior custom · 2026-08-01. Use suggestion: 55.5 VES per USD")
		);
		expect(onUseSuggestion).toHaveBeenCalledWith(55.5, "custom");
	});

	it("names equal-valued suggestions with their visible policy so assistive technology can distinguish them", async () => {
		const { getByLabelText } = await render(
			<TransactionFormRateSection {...baseProps} suggestions={{ ...baseProps.suggestions, official: 55.5 }} />
		);

		expect(getByLabelText("Current suggestion · Official. Use suggestion: 55.5 VES per USD")).toBeTruthy();
		expect(
			getByLabelText("Prior custom suggestion · Custom · Prior custom · 2026-08-01. Use suggestion: 55.5 VES per USD")
		).toBeTruthy();
	});

	it("renders the positive-rate validation message beside the custom affordance", async () => {
		const { getByText, getByRole } = await render(
			<TransactionFormRateSection
				{...baseProps}
				error="Enter a positive rate"
				selection={{ exchangeRate: null, exchangeRateType: "custom" }}
			/>
		);

		expect(getByText("Enter a positive rate")).toBeTruthy();
		expect(getByText("The rate must be greater than zero.")).toBeTruthy();
		expect(getByRole("button", { name: "Edit custom rate" })).toBeTruthy();
	});
});
