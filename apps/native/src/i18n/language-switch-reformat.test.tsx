import { act, render, screen } from "@testing-library/react-native";

jest.mock("./language-storage", () => ({
	deviceLanguageTag: jest.fn(),
	persistLanguagePreference: jest.fn(),
	readLanguagePreference: jest.fn(),
}));

import { DayTotal } from "@/components/amount-text";
import { LanguageProvider, useLanguage } from "./context";
import { readLanguagePreference } from "./language-storage";
import type { LanguagePreference } from "./languages";

const mockReadLanguagePreference = readLanguagePreference as jest.Mock;

let setPreference: (next: LanguagePreference) => void = () => {
	throw new Error("provider not mounted");
};

/** Reaches the setter without rendering a control the assertions would match. */
function CaptureSetter() {
	const { setPreference: setter } = useLanguage();
	setPreference = setter;
	return null;
}

const TOTALS = [{ amount: -760.24, currencyCode: "USD", transactionCount: 1 }];

/**
 * `DayTotal` formats money but translates nothing. That combination is the
 * regression: language reaches the formatters through `runtimeLanguage()`, a
 * module global React cannot see, so a component that does not consume the
 * language context is bailed out of the re-render — `LanguageProvider` receives
 * `children` as an unchanged element — and keeps printing the previous locale
 * until the app is relaunched.
 */
describe("switching language mid-session", () => {
	it("reformats money in a component that formats but does not translate", async () => {
		mockReadLanguagePreference.mockResolvedValue("en");
		await act(async () => {
			render(
				<LanguageProvider>
					<CaptureSetter />
					<DayTotal totals={TOTALS} />
				</LanguageProvider>
			);
		});

		expect(screen.getByText("-$760.24")).toBeTruthy();

		await act(async () => {
			setPreference("es");
		});

		expect(screen.getByText("-760,24 $")).toBeTruthy();
	});
});
