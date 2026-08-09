import { fireEvent, render } from "@testing-library/react-native";
import { Account } from "./account";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => ({}),
}));

interface StubButtonsProps {
	busy: string | null;
	start: (provider: string, getToken: () => Promise<string | null>) => void;
}

jest.mock("@/components/account/provider-sign-in-buttons", () => {
	const { Pressable, Text } = require("react-native");
	return {
		ProviderSignInButtons: ({ busy, start }: StubButtonsProps) => (
			<Pressable onPress={() => start("apple", () => Promise.resolve("token"))} testID="provider-sign-in-buttons-stub">
				<Text>{busy ?? "idle"}</Text>
			</Pressable>
		),
	};
});

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

const mockUseSession = jest.fn();
const mockClient = {
	deleteUser: jest.fn(),
	signOut: jest.fn(),
	useSession: mockUseSession,
};
jest.mock("@/lib/auth-client", () => ({
	get authClient() {
		return mockClient;
	},
}));

const mockUseProviderSignIn = jest.fn();
jest.mock("@/lib/use-provider-sign-in", () => ({
	useProviderSignIn: (...args: unknown[]) => mockUseProviderSignIn(...args),
}));

const routerSpy = jest.requireMock("expo-router").router as Record<string, jest.Mock>;

function calledRouterMethods(): string[] {
	return Object.entries(routerSpy)
		.filter(([, method]) => method.mock.calls.length > 0)
		.map(([name]) => name);
}

beforeEach(() => {
	mockUseProviderSignIn.mockReturnValue({
		busy: null,
		error: null,
		start: jest.fn(),
	});
});

describe("Account — restoring", () => {
	it("shows only the checking title, no detail, no button", async () => {
		mockUseSession.mockReturnValue({ data: undefined, isPending: true });
		const { getByText, queryAllByRole, queryByTestId, queryByText } = await render(<Account />);
		expect(getByText("settings.account.checking")).toBeTruthy();
		expect(queryByText("settings.account.signedOutDetail")).toBeNull();
		expect(queryAllByRole("button")).toHaveLength(0);
		expect(queryByTestId("provider-sign-in-buttons-stub")).toBeNull();
		expect(calledRouterMethods()).toEqual([]);
	});
});

describe("Account — signed-out", () => {
	beforeEach(() => {
		mockUseSession.mockReturnValue({ data: undefined, isPending: false });
	});

	it("shows notSignedIn, signedOutDetail and the sign-in controls", async () => {
		const { getByText, getByTestId } = await render(<Account />);
		expect(getByText("settings.account.notSignedIn")).toBeTruthy();
		expect(getByText("settings.account.signedOutDetail")).toBeTruthy();
		expect(getByText("settings.account.signInSection")).toBeTruthy();
		expect(getByText("settings.account.signInFooter")).toBeTruthy();
		expect(getByTestId("provider-sign-in-buttons-stub")).toBeTruthy();
		expect(calledRouterMethods()).toEqual([]);
	});

	it("renders Failure with the mapped message on a rejected sign-in", async () => {
		mockUseProviderSignIn.mockReturnValue({
			busy: null,
			error: "settings.account.genericFailure",
			start: jest.fn(),
		});
		const { getByText } = await render(<Account />);
		expect(getByText("settings.account.genericFailure")).toBeTruthy();
		expect(calledRouterMethods()).toEqual([]);
	});

	it("wires the stub's press through to useProviderSignIn's start", async () => {
		const start = jest.fn();
		mockUseProviderSignIn.mockReturnValue({ busy: null, error: null, start });
		const { getByTestId } = await render(<Account />);
		fireEvent.press(getByTestId("provider-sign-in-buttons-stub"));
		expect(start).toHaveBeenCalledWith("apple", expect.any(Function));
		expect(calledRouterMethods()).toEqual([]);
	});
});

describe("Account — signed-in", () => {
	it("shows the label plus sign-out and delete rows, no sign-in controls", async () => {
		mockUseSession.mockReturnValue({
			data: { user: { email: "jane@example.com", name: "Jane" } },
			isPending: false,
		});
		const { getByText, getByRole, queryByTestId, queryAllByRole } = await render(<Account />);
		expect(getByText("settings.account.signedInAs")).toBeTruthy();
		expect(getByText("Jane")).toBeTruthy();
		expect(getByRole("button", { name: "settings.account.signOut" })).toBeTruthy();
		expect(getByRole("button", { name: "settings.account.delete" })).toBeTruthy();
		expect(queryByTestId("provider-sign-in-buttons-stub")).toBeNull();
		expect(queryAllByRole("button")).toHaveLength(2);
		expect(calledRouterMethods()).toEqual([]);
	});
});
