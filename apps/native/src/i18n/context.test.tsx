import { act, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState, type AppStateStatus, Text } from "react-native";

jest.mock("./language-storage", () => ({
	deviceLanguageTag: jest.fn(),
	persistLanguagePreference: jest.fn(),
	readLanguagePreference: jest.fn(),
}));

import { LanguageProvider, useLanguage } from "./context";
import { deviceLanguageTag, readLanguagePreference } from "./language-storage";
import { DEFAULT_LANGUAGE, type LanguagePreference } from "./languages";
import { runtimeLanguage, setRuntimeLanguage } from "./runtime";

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

function RuntimeLanguage() {
	useLanguage();
	return <Text testID="runtime">{runtimeLanguage()}</Text>;
}

async function renderProvider(
	preference: LanguagePreference,
	children: ReactNode = <CurrentLanguage />,
) {
	mockReadLanguagePreference.mockResolvedValue(preference);
	const appState = watchAppState();
	await act(async () => {
		render(<LanguageProvider>{children}</LanguageProvider>);
	});
	return appState;
}

afterEach(() => {
	AppState.addEventListener = realAddEventListener;
	mockDeviceLanguageTag.mockReset();
	mockReadLanguagePreference.mockReset();
	setRuntimeLanguage(DEFAULT_LANGUAGE);
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

	it("has the runtime language in place before its children render", async () => {
		mockDeviceLanguageTag.mockReturnValue("en-US");
		const appState = await renderProvider("system", <RuntimeLanguage />);
		expect(screen.getByTestId("runtime")).toHaveTextContent("en");

		mockDeviceLanguageTag.mockReturnValue("es-MX");
		await appState.emit("active");

		expect(screen.getByTestId("runtime")).toHaveTextContent("es");
	});

	it("keeps an explicit preference when the device language changes", async () => {
		mockDeviceLanguageTag.mockReturnValue("en-US");
		const appState = await renderProvider("en");

		mockDeviceLanguageTag.mockReturnValue("es-MX");
		await appState.emit("active");

		expect(screen.getByTestId("language")).toHaveTextContent("en");
	});
});
