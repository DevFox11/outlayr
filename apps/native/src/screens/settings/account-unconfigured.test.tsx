import { render } from "@testing-library/react-native";
import AccountRoute from "./account";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => ({}),
}));

jest.mock("@/lib/auth-client", () => ({ authClient: null }));

jest.mock("@/lib/google-sign-in", () => ({
	isGoogleSignInAvailable: false,
	googleIdToken: jest.fn(),
}));

jest.mock("expo-router", () => ({
	router: {
		back: jest.fn(),
		canDismiss: jest.fn(),
		dismiss: jest.fn(),
		dismissAll: jest.fn(),
		navigate: jest.fn(),
		push: jest.fn(),
		replace: jest.fn(),
		setParams: jest.fn(),
	},
}));

const routerSpy = jest.requireMock("expo-router").router as Record<
	string,
	jest.Mock
>;

describe("AccountRoute — unconfigured build", () => {
	it("renders AccountUnavailable with no pressable elements", async () => {
		const { getByText, queryAllByRole, queryByTestId } = await render(
			<AccountRoute />,
		);
		expect(getByText("settings.account.unavailable")).toBeTruthy();
		expect(getByText("settings.account.unavailableDetail")).toBeTruthy();
		expect(queryAllByRole("button")).toHaveLength(0);
		expect(queryByTestId("provider-sign-in-buttons-stub")).toBeNull();
		for (const method of Object.values(routerSpy)) {
			expect(method).not.toHaveBeenCalled();
		}
	});
});
