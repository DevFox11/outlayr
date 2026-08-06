import { fireEvent, render } from "@testing-library/react-native";
import { AccountsOverviewCard } from "./accounts-overview-card";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

describe("AccountsOverviewCard", () => {
	it("renders nothing when there are no accounts", async () => {
		const { toJSON } = await render(
			<AccountsOverviewCard
				currency="USD"
				onPress={() => {}}
				overview={null}
				showCents
			/>,
		);
		expect(toJSON()).toBeNull();
	});

	it("shows the count and the valued total", async () => {
		const { getByText } = await render(
			<AccountsOverviewCard
				currency="USD"
				onPress={() => {}}
				overview={{ count: 3, total: 4210.55, exact: true }}
				showCents
			/>,
		);
		getByText("accounts.overview.heading · 3");
		getByText("$4,210.55");
	});

	it("prints a negative total with its sign", async () => {
		const { getByText } = await render(
			<AccountsOverviewCard
				currency="USD"
				onPress={() => {}}
				overview={{ count: 1, total: -120, exact: true }}
				showCents
			/>,
		);
		getByText("-$120.00");
	});

	it("marks an approximate total with the currency chip", async () => {
		const { getByText, queryByText, rerender } = await render(
			<AccountsOverviewCard
				currency="USD"
				onPress={() => {}}
				overview={{ count: 2, total: 100, exact: false }}
				showCents
			/>,
		);
		getByText("USD?");

		await rerender(
			<AccountsOverviewCard
				currency="USD"
				onPress={() => {}}
				overview={{ count: 2, total: 100, exact: true }}
				showCents
			/>,
		);
		expect(queryByText("USD?")).toBeNull();
	});

	it("routes the tap through onPress", async () => {
		const onPress = jest.fn();
		const { getByTestId } = await render(
			<AccountsOverviewCard
				currency="USD"
				onPress={onPress}
				overview={{ count: 1, total: 0, exact: true }}
				showCents
			/>,
		);
		fireEvent.press(getByTestId("accounts-overview-card"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});
});
