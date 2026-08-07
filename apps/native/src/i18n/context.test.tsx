import { act, render, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus, Text } from "react-native";

jest.mock("./language-storage", () => ({
	deviceLanguageTag: jest.fn(),
	persistLanguagePreference: jest.fn(),
	readLanguagePreference: jest.fn(),
}));

import { LanguageProvider, useLanguage } from "./context";
import { deviceLanguageTag, readLanguagePreference } from "./language-storage";
import type { LanguagePreference } from "./languages";

const mockDeviceLanguageTag = deviceLanguageTag as jest.Mock;
const mockReadLanguagePreference = readLanguagePreference as jest.Mock;

const realAddEventListener = AppState.addEventListener;

function watchAppState() {
	const listeners: ((status: AppStateStatus) => void)[] = [];

	AppState.addEventListener = ((event: string, listener: unknown) => {
		if (event === "change") {
			listeners.push(listener as (status: AppStateStatus) => void);
		}
		return { remove: jest.fn() };
	}) as typeof AppState.addEventListener;

	return {
		async emit(status: AppStateStatus) {
			await act(async () => {
				for (const listener of listeners) {
					listener(status);
				}
			});
		},
	};
}

function CurrentLanguage() {
	const { language } = useLanguage();
	return <Text testID="language">{language}</Text>;
}

async function renderProvider(preference: LanguagePreference) {
	mockReadLanguagePreference.mockResolvedValue(preference);
	const appState = watchAppState();
	await act(async () => {
		render(
			<LanguageProvider>
				<CurrentLanguage />
			</LanguageProvider>,
		);
	});
	return appState;
}

afterEach(() => {
	AppState.addEventListener = realAddEventListener;
	mockDeviceLanguageTag.mockReset();
	mockReadLanguagePreference.mockReset();
});

describe("LanguageProvider", () => {
	it("resolves the device language when the preference is the system one", async () => {
		mockDeviceLanguageTag.mockReturnValue("es-MX");

		await renderProvider("system");

		expect(screen.getByTestId("language")).toHaveTextContent("es");
	});

	it("follows a device language change made while the app was backgrounded", async () => {
		mockDeviceLanguageTag.mockReturnValue("en-US");
		const appState = await renderProvider("system");
		expect(screen.getByTestId("language")).toHaveTextContent("en");

		mockDeviceLanguageTag.mockReturnValue("es-MX");
		await appState.emit("active");

		expect(screen.getByTestId("language")).toHaveTextContent("es");
	});

	it("keeps an explicit preference when the device language changes", async () => {
		mockDeviceLanguageTag.mockReturnValue("en-US");
		const appState = await renderProvider("en");

		mockDeviceLanguageTag.mockReturnValue("es-MX");
		await appState.emit("active");

		expect(screen.getByTestId("language")).toHaveTextContent("en");
	});
});
