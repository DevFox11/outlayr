import { render } from "@testing-library/react-native";
import { TransactionRow } from "./transaction-row";

jest.mock("@/contexts/display-settings-context", () => ({
	useDisplaySettings: () => ({ state: { showCents: true, swapTimeLabel: false, use24Hour: false } }),
}));
jest.mock("@/i18n/context", () => ({
	useLanguage: () => ({ language: "en" }),
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		future: "#8A8578",
		income: "#3D7A5C",
		muted: "#8A8578",
		surfaceSecondary: "#F7F5EF",
		transfer: "#427AA1",
	}),
}));

const PENDING_CUSTOM = {
	amount: 100,
	amountUsd: null,
	categoryColor: null,
	categoryEmoji: null,
	categoryIcon: null,
	categoryId: "category-1",
	categoryName: "Shopping",
	currency: "VES",
	customColor: null,
	date: new Date("2026-08-10T12:00:00.000Z"),
	day: new Date("2026-08-10T00:00:00.000Z"),
	emoji: null,
	exchangeRate: null,
	exchangeRateType: "custom",
	icon: null,
	id: "pending-1",
	imageColor: null,
	imageUri: null,
	income: false,
	note: "Market purchase",
	recurringCoefficient: 1,
	recurringEndDate: null,
	recurringType: 0,
};

describe("TransactionRow", () => {
	it("shows an accessible Rate needed badge for the derived pending custom triple", async () => {
		const { getByLabelText, getByText } = await render(
			<TransactionRow currency="USD" onLongPress={() => {}} onPress={() => {}} transaction={PENDING_CUSTOM as never} />
		);

		expect(getByText("log.row.rateNeeded")).toBeTruthy();
		expect(getByLabelText("log.row.rateNeededAccessibility")).toBeTruthy();
	});
});
