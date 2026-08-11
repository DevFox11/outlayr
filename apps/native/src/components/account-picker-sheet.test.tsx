import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { act, render } from "@testing-library/react-native";
import { createRef } from "react";
import type { Account } from "@/data/accounts-core";
import type { Database } from "@/db/client";
import { AccountPickerSheet } from "./account-picker-sheet";

const ACCOUNTS = [
	{ currency: "USD", id: "a", name: "Chequing" },
	{ currency: "VES", id: "b", name: "Efectivo" },
] as Account[];

jest.mock("@/i18n/context", () => ({
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({ foreground: "#17150F", muted: "#8A8578", surfaceSecondary: "#F7F5EF", tint: "#3D7A5C" }),
}));
jest.mock("@/data/accounts", () => ({ useAccounts: () => ACCOUNTS }));

const db = {} as Database;

async function presented(allowNone?: boolean) {
	const ref = createRef<BottomSheetModal>();
	const view = await render(
		<AccountPickerSheet
			allowNone={allowNone}
			db={db}
			onCreate={() => {}}
			onSelect={() => {}}
			ref={ref}
			selectedId="a"
		/>
	);
	await act(async () => {
		ref.current?.present();
	});
	return view;
}

describe("AccountPickerSheet", () => {
	it("offers None by default, for the callers where no account is a real answer", async () => {
		const { queryByText } = await presented();
		expect(queryByText("transaction.account.none")).not.toBeNull();
	});

	it("withholds None when the caller requires an account", async () => {
		const { queryByText } = await presented(false);
		expect(queryByText("transaction.account.none")).toBeNull();
	});

	it("still lists every account when None is withheld", async () => {
		const { queryByText } = await presented(false);
		expect(queryByText("Chequing")).not.toBeNull();
		expect(queryByText("Efectivo")).not.toBeNull();
	});
});
