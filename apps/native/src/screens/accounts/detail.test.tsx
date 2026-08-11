import { fireEvent, render } from "@testing-library/react-native";
import type { TransactionWithCategory } from "@/data/transactions";
import { AccountDetail } from "./detail";

const AUG_9 = new Date(2026, 7, 9, 12);

const mockPush = jest.fn();

jest.mock("expo-router", () => {
	const Noop = () => null;
	return {
		Stack: Object.assign(Noop, {
			Header: Noop,
			Screen: Object.assign(Noop, { BackButton: Noop, Title: Noop }),
			Toolbar: Object.assign(Noop, { Button: Noop }),
		}),
		useRouter: () => ({ back: jest.fn(), push: mockPush }),
	};
});

interface StubSectionListProps {
	ListEmptyComponent: React.ReactNode;
	ListHeaderComponent: React.ReactNode;
	renderItem: (info: { item: { id: string } }) => React.ReactNode;
	renderSectionHeader: (info: { section: { data: { id: string }[]; day: Date } }) => React.ReactNode;
	sections: { data: { id: string }[]; day: Date }[];
}

// The real list measures before it renders a row, and jest has no layout pass.
jest.mock("@legendapp/list/section-list", () => {
	const { View } = require("react-native");
	return {
		SectionList: ({
			sections,
			renderItem,
			renderSectionHeader,
			ListEmptyComponent,
			ListHeaderComponent,
		}: StubSectionListProps) => (
			<View>
				{ListHeaderComponent}
				{sections.length === 0 ? ListEmptyComponent : null}
				{sections.map((section) => (
					<View key={section.day.getTime()}>
						{renderSectionHeader({ section })}
						{section.data.map((item) => (
							<View key={item.id}>{renderItem({ item })}</View>
						))}
					</View>
				))}
			</View>
		),
	};
});

// uniwind resolves the theme variables through the native runtime, which jest has none of.
jest.mock("@/theme/use-colors", () => ({
	SYSTEM_COLORS: { card: "#ffffff", groupedBackground: "#f2f0ea", separator: "#cccccc" },
	useColors: () => new Proxy({}, { get: () => "#17150f" }),
}));

jest.mock("@/i18n/context", () => ({
	useTranslation: () => (key: string) => key,
}));

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => ({}),
}));

jest.mock("@/contexts/display-settings-context", () => ({
	useDisplaySettings: () => ({
		state: { showCents: true, swapTimeLabel: false, use24Hour: false },
	}),
}));

const mockTransactions = jest.fn();
const mockTransfers = jest.fn();

jest.mock("@/data/accounts", () => ({
	useAccountBalance: () => ({ exact: true, total: 40 }),
	useAccounts: () => [
		{
			currency: "USD",
			id: "savings",
			initialBalance: 0,
			initialBalanceDate: new Date(2026, 7, 9, 12),
			name: "Savings",
		},
	],
	useAccountTransactions: () => mockTransactions(),
}));

jest.mock("@/data/account-transfers", () => ({
	useAccountTransfers: () => mockTransfers(),
}));

jest.mock("@/data/use-valuation", () => ({
	useValuationIn: () => ({ displayCurrency: "USD", rates: undefined }),
}));

function transaction(id: string, note: string, amount = 12): TransactionWithCategory {
	return {
		amount,
		amountUsd: amount,
		categoryColor: null,
		categoryEmoji: null,
		categoryIcon: null,
		categoryId: null,
		categoryName: null,
		currency: "USD",
		customColor: null,
		date: AUG_9,
		day: AUG_9,
		emoji: null,
		exchangeRate: null,
		exchangeRateType: null,
		icon: null,
		id,
		imageColor: null,
		imageUri: null,
		income: false,
		note,
		recurringCoefficient: 1,
		recurringEndDate: null,
		recurringType: 0,
	};
}

function transfer(id: string, note: string) {
	return {
		amount: 40,
		amountUsd: 40,
		categoryColor: null,
		categoryEmoji: null,
		categoryIcon: null,
		categoryId: null,
		categoryName: null,
		currency: "USD",
		customColor: null,
		date: AUG_9,
		day: AUG_9,
		emoji: null,
		excludedFromTotals: true as const,
		icon: null,
		id,
		imageColor: null,
		imageUri: null,
		income: false,
		note,
		recurringCoefficient: 1,
		recurringEndDate: null,
		recurringType: 0,
		transferId: id,
		transferTo: null,
	};
}

beforeEach(() => {
	mockPush.mockClear();
	mockTransactions.mockReturnValue([]);
	mockTransfers.mockReturnValue([]);
});

describe("an account's history", () => {
	it("lists a transfer that moved money into the account", async () => {
		mockTransfers.mockReturnValue([transfer("tr1", "Checking → Savings")]);

		const { getByText } = await render(<AccountDetail id="savings" />);

		getByText("Checking → Savings");
	});

	it("lists a transfer that moved money out of the account", async () => {
		mockTransfers.mockReturnValue([transfer("tr1", "Savings → Checking")]);

		const { getByText } = await render(<AccountDetail id="savings" />);

		getByText("Savings → Checking");
	});

	it("stands the empty state down when the only history is a transfer", async () => {
		mockTransfers.mockReturnValue([transfer("tr1", "Checking → Savings")]);

		const { queryByText } = await render(<AccountDetail id="savings" />);

		expect(queryByText("accounts.detail.empty")).toBeNull();
	});

	it("still says nothing is attached when there is neither a transaction nor a transfer", async () => {
		const { getByText } = await render(<AccountDetail id="savings" />);

		getByText("accounts.detail.empty");
	});

	it("leaves the day's total to the transactions around the transfer", async () => {
		mockTransactions.mockReturnValue([transaction("t1", "Coffee"), transaction("t2", "Bus", 8)]);
		mockTransfers.mockReturnValue([transfer("tr1", "Checking → Savings")]);

		const { getByText } = await render(<AccountDetail id="savings" />);

		getByText("-$20.00");
	});

	it("opens the transfer behind a transfer row, not a transaction that does not exist", async () => {
		mockTransfers.mockReturnValue([transfer("tr1", "Checking → Savings")]);

		const { getByText } = await render(<AccountDetail id="savings" />);
		await fireEvent.press(getByText("Checking → Savings"));

		expect(mockPush).toHaveBeenCalledWith("/transactions/transfers/tr1");
	});

	it("opens the transaction behind an ordinary row", async () => {
		mockTransactions.mockReturnValue([transaction("t1", "Coffee")]);

		const { getByText } = await render(<AccountDetail id="savings" />);
		await fireEvent.press(getByText("Coffee"));

		expect(mockPush).toHaveBeenCalledWith("/transactions/t1");
	});
});
