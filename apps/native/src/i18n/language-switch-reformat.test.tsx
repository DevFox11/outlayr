import { act, render, screen } from "@testing-library/react-native";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";

jest.mock("expo-localization", () => ({
    getLocales: jest.fn(),
}));

import { getLocales } from "expo-localization";

import { DayTotal } from "@/components/amount-text";

import { LanguageProvider } from "./context";

const mockGetLocales = getLocales as jest.Mock;

function setDeviceLanguage(tag: string) {
    mockGetLocales.mockReturnValue([{ languageTag: tag }]);
}

const realAddEventListener = AppState.addEventListener;

/** Drives the foreground transition the provider re-reads the locale on. */
function watchAppState() {
    const listeners: ((status: AppStateStatus) => void)[] = [];
    AppState.addEventListener = ((event: string, listener: unknown) => {
        if (event === "change") {
            listeners.push(listener as (status: AppStateStatus) => void);
        }
        return { remove: jest.fn() };
    }) as typeof AppState.addEventListener;
    return {
        async returnToForeground() {
            await act(async () => {
                for (const listener of listeners) {
                    listener("active");
                }
            });
        },
    };
}

afterEach(() => {
    AppState.addEventListener = realAddEventListener;
    mockGetLocales.mockReset();
});

const TOTALS = [{ amount: -760.24, currencyCode: "USD", transactionCount: 1 }];

/**
 * `DayTotal` formats money but translates nothing. That combination is the
 * regression: language reaches the formatters through `runtimeLanguage()`, a
 * module global React cannot see, so a component that does not consume the
 * language context is bailed out of the re-render — `LanguageProvider` receives
 * `children` as an unchanged element — and keeps printing the previous locale.
 *
 * The trigger is now a device language change, which is what returning from
 * Settings › Outlayr › Language looks like to the app.
 */
describe("changing the device language mid-session", () => {
    it("reformats money in a component that formats but does not translate", async () => {
        setDeviceLanguage("en-US");
        const appState = watchAppState();
        await act(async () => {
            render(
                <LanguageProvider>
                    <DayTotal totals={TOTALS} />
                </LanguageProvider>
            );
        });

        expect(screen.getByText("-$760.24")).toBeTruthy();

        setDeviceLanguage("es-MX");
        await appState.returnToForeground();

        expect(screen.getByText("-760,24 $")).toBeTruthy();
    });
});
