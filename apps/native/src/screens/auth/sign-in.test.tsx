import { render } from "@testing-library/react-native";
import SignInScreen from "./sign-in";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/lib/auth-client", () => ({ authClient: {} }));

jest.mock("@/lib/google-sign-in", () => ({
	isGoogleSignInAvailable: false,
	googleIdToken: jest.fn(),
}));

jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({ background: "#F2F0EA" }),
}));

jest.mock("@/lib/use-provider-sign-in", () => ({
	useProviderSignIn: () => ({
		busy: null,
		error: "settings.account.genericFailure",
		start: jest.fn(),
	}),
}));

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
	useLanguage: () => ({ language: "en" }),
}));

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => ({}),
}));

jest.mock("@/contexts/display-settings-context", () => ({
	useAppSettings: () => ({
		state: { number: () => 0 },
	}),
}));

jest.mock("@/data/app-meta", () => ({ useGlobalCurrency: () => "USD" }));

jest.mock("@/data/onboarding", () => ({
	deferAccount: jest.fn(),
	useReminderChosen: () => false,
}));

describe("sign-in screen", () => {
	it("routes a rejected sign-in into FirstRun's error slot, not the button component", async () => {
		const { getByRole, getByText } = await render(<SignInScreen />);
		const alert = getByRole("alert");
		expect(alert.props.children).toBe("settings.account.genericFailure");
		expect(getByText("settings.account.genericFailure")).toBeTruthy();
	});
});
