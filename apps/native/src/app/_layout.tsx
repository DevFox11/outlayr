import "../../global.css";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { GeistMono_400Regular, GeistMono_500Medium, useFonts } from "@expo-google-fonts/geist-mono";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { useConvexAuth } from "convex/react";
import type { ErrorBoundaryProps } from "expo-router";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { hideAsync, preventAutoHideAsync } from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PanelUIProvider, useTheme } from "panelui-native";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { SafeAreaListener, SafeAreaProvider } from "react-native-safe-area-context";
import { Uniwind, useCSSVariable } from "uniwind";

import { AppLockGate } from "@/components/app-lock-gate";
import { AuthCover } from "@/components/auth-cover";
import { CelebrationConfetti } from "@/components/confetti";
import { LocalDataError } from "@/components/local-data-error";
import { Text } from "@/components/text";
import { UpdateSheet } from "@/components/update-sheet";
import { AppSettingsProvider } from "@/contexts/display-settings-context";
import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import { LocalDataProvider, useDatabase, useLocalData } from "@/contexts/local-data-context";
import { RevenueCatProvider } from "@/contexts/revenuecat-context";
import { BackgroundWork } from "@/data/background-work";
import { useAccountDeferred, useOnboardingSettled } from "@/data/onboarding";
import { useSeededClockPreference } from "@/data/settings";
import { DeferredDeleteProvider } from "@/data/use-deferred-delete";
import { rootStackGroup } from "@/domain/auth-gate";
import { MODAL_SCREENS, SHEET_SCREENS, TITLED_SCREENS } from "@/domain/root-stack";
import { localShellReady, routeSettled } from "@/domain/splash-gate";
import { LanguageProvider, useTranslation } from "@/i18n/context";
import { translateNow } from "@/i18n/runtime";
import { AuthSessionProvider, useAuthSession } from "@/lib/auth-session";
import { cloudRuntime } from "@/lib/cloud-runtime";
import { setCloudAuthenticated } from "@/lib/convex";
import { DeviceResetRecovery } from "@/lib/device-reset-recovery";
import { LedgerAdoptionProvider, useLedgerAdoption } from "@/lib/ledger-adoption";
import { useScreenTracking } from "@/lib/posthog";
import { useAnalyticsConsent } from "@/lib/posthog-consent";
import { usePostHogIdentity } from "@/lib/posthog-identity";
import { identityPickerDetent } from "@/lib/sheet-detents";
import { useSubscriptionReminderSync } from "@/lib/subscription-reminder-sync";
import { useAccent } from "@/theme/use-accent";
import { useApplyThemePreference } from "@/theme/use-theme-preference";

preventAutoHideAsync();

export const unstable_settings = {
    anchor: "(tabs)",
};

/**
 * Renders in place of the provider tree it is guarding, so it reads the language
 * off the runtime rather than through `useTranslation`.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    return (
        <View className="bg-background flex-1 items-center justify-center px-8">
            <Text className="font-sans-semibold text-foreground text-title pb-2">
                {translateNow("error.boundary.title")}
            </Text>
            <Text className="text-muted text-subtitle pb-4 text-center">{translateNow("error.boundary.body")}</Text>
            <Text className="text-label text-muted pb-6 text-center">{error.message}</Text>
            <Pressable
                accessibilityRole="button"
                className="bg-accent rounded-full px-6 py-3"
                onPress={() => {
                    retry();
                }}
            >
                <Text className="font-sans-semibold text-accent-foreground text-subtitle">
                    {translateNow("common.retry")}
                </Text>
            </Pressable>
        </View>
    );
}

function CloudRuntimeProvider({ children }: { children: ReactNode }) {
    return (
        <AuthSessionProvider>
            <RevenueCatProvider>
                <ActivatedCloudRuntime>{children}</ActivatedCloudRuntime>
            </RevenueCatProvider>
        </AuthSessionProvider>
    );
}

function Analytics() {
    useAnalyticsConsent();
    useScreenTracking();
    return null;
}

function ActivatedCloudRuntime({ children }: { children: ReactNode }) {
    const { accountId } = useAuthSession();
    usePostHogIdentity();
    if (cloudRuntime === null || accountId === null) {
        return children;
    }
    return (
        <ConvexBetterAuthProvider authClient={cloudRuntime.authClient} client={cloudRuntime.convex}>
            <CloudAuthMirror />
            {children}
        </ConvexBetterAuthProvider>
    );
}

function CloudAuthMirror() {
    const { isAuthenticated } = useConvexAuth();
    useEffect(() => {
        setCloudAuthenticated(isAuthenticated);
        return () => {
            setCloudAuthenticated(false);
        };
    }, [isAuthenticated]);
    return null;
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
    const { status } = useLocalData();
    // Above the splash gate on purpose: the accent has to be written into both
    // themes before the first screen paints, not after it.
    useAccent();
    useApplyThemePreference();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [splashHidden, setSplashHidden] = useState(false);
    // SAFETY: uniwind types the batched read as (string | undefined)[]; every name
    // below is declared in global.css, so each slot resolves.
    const [background, card, text, border, primary] = useCSSVariable([
        "--background",
        "--color-card",
        "--foreground",
        "--border",
        "--color-tint",
    ]) as string[];

    const hideSplash = useCallback(() => {
        hideAsync();
        setSplashHidden(true);
    }, []);

    // An error surface beats an indefinite splash, but it is written in the
    // owner's language, so it still waits on the catalog.
    const failed = fontsLoaded && status === "error";

    useEffect(() => {
        if (failed) {
            // oxlint-disable-next-line react/react-compiler -- `hideSplash` calls the native splash API and records that it did; the flag exists because that call is not repeatable, so it cannot be derived.
            hideSplash();
        }
    }, [failed, hideSplash]);

    const base = isDark ? DarkTheme : DefaultTheme;

    if (localShellReady({ data: status, fontsLoaded })) {
        return (
            <LedgerAdoptionProvider>
                <DeviceResetRecovery>
                    <RouteGate hideSplash={hideSplash} splashHidden={splashHidden}>
                        <BackgroundWork />
                        <StatusBar style={isDark ? "light" : "dark"} />

                        <ThemeProvider
                            value={{
                                ...base,
                                // `primary` too, or React Navigation keeps its own iOS blue on every
                                // native toolbar button — the CSS token never reaches native chrome.
                                colors: { ...base.colors, background, border, card, primary, text },
                                dark: isDark,
                            }}
                        >
                            <AuthCover>
                                <AppLockGate>
                                    <RootStack />
                                    <Analytics />
                                    <UpdateSheet />
                                    <CelebrationConfetti />
                                </AppLockGate>
                            </AuthCover>
                        </ThemeProvider>
                    </RouteGate>
                </DeviceResetRecovery>
            </LedgerAdoptionProvider>
        );
    }

    // Latched on the splash, because `retry()` walks the status back through
    // opening → migrating → seeding: blanking on those once the splash is gone
    // would empty the screen for the length of the attempt, and permanently if
    // the migration never answers on a locked or corrupt file.
    if (!splashHidden) {
        return null;
    }

    return <LocalDataError />;
}

/**
 * Holds the splash until `rootStackGroup` can name a destination, so the first
 * frame is the screen the owner is going to rather than a cover on the way to
 * it. Both waits are bounded — `AUTH_RESTORE_BUDGET_MS` and an adoption run
 * that settles even when it throws.
 *
 * Latched like the gate above, and `AuthCover` stays: a sign-in re-enters
 * `resolving` long after launch, where a splash is not the right cover.
 */
function RouteGate({
    children,
    hideSplash,
    splashHidden,
}: {
    children: ReactNode;
    hideSplash: () => void;
    splashHidden: boolean;
}) {
    const { gate } = useAuthSession();
    const { status } = useLedgerAdoption();
    const settled = routeSettled({ adoption: status, gate });

    useEffect(() => {
        if (settled) {
            hideSplash();
        }
    }, [settled, hideSplash]);

    if (!(settled || splashHidden)) {
        return null;
    }

    return children;
}

/**
 * A bare chevron over the step's own background: `minimal` drops the back title,
 * which would otherwise read the cover's title from behind it. `fade` swaps the
 * default horizontal push for a crossfade, so advancing reads as the stage
 * trading objects rather than a new page sliding in.
 */
const FIRST_RUN_STEP = {
    animation: "fade",
    headerBackButtonDisplayMode: "minimal",
    headerShadowVisible: false,
    headerTransparent: true,
    title: "",
} as const;

/**
 * Split from `RootNavigator` so `useDatabase` is only ever called below the
 * splash gate, where the database is guaranteed open.
 */
function RootStack() {
    const db = useDatabase();
    const t = useTranslation();
    const onboarded = useOnboardingSettled(db);
    const deferred = useAccountDeferred(db);
    const { gate } = useAuthSession();
    const { status: adoption } = useLedgerAdoption();
    const { height: windowHeight } = useWindowDimensions();
    const pickerDetent = identityPickerDetent(windowHeight);
    useSubscriptionReminderSync(db);
    useSeededClockPreference(db);

    const group = rootStackGroup({
        deferred,
        gate,
        onboarded,
        reconciled: adoption === "settled",
    });

    return (
        <Stack>
            {/* Declared before `(tabs)`: with the anchor guarded away on a first run,
			    the stack opens on whatever screen is left first. */}
            <Stack.Protected guard={group === "onboarding"}>
                <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
                {/* The steps carry the OS back button rather than a drawn one, which
				    brings the matching hit target with it. Transparent, because the
				    stock theme card differs from the flow's `--fr-ground` — an opaque
				    bar would band the top. */}
                <Stack.Screen name="onboarding/currency" options={FIRST_RUN_STEP} />
                <Stack.Screen name="onboarding/grounding" options={FIRST_RUN_STEP} />
                <Stack.Screen name="onboarding/rhythm" options={FIRST_RUN_STEP} />
            </Stack.Protected>

            {/* Behind onboarding, not in front of it: the currency step is the only
			    thing that writes `currencyChosen`, and canonicalization declines
			    every row on a ledger that lacks it (`docs/convex-sync-design.md`
			    §1.7). A device has to state its currency before it holds a ledger,
			    not after an account has handed it one. */}
            <Stack.Protected guard={group === "sign-in"}>
                <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
            </Stack.Protected>

            <Stack.Protected guard={group === "adopt"}>
                <Stack.Screen name="auth/adopt" options={{ gestureEnabled: false, headerShown: false }} />
            </Stack.Protected>

            {/* `StackRouter.getStateForRouteNamesChange` only filters `state.routes`
			    against the new `routeNames` and re-seats on `routeNames[0]` solely
			    when that filter leaves zero routes. Every root screen has to sit in
			    exactly one of these four groups — an aux screen declared outside all
			    of them would survive a guard flip and strand the stack on it, with no
			    tab bar and no way back. */}
            <Stack.Protected guard={group === "ledger"}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

                <Stack.Screen
                    name="search"
                    options={{
                        presentation: "modal",
                        sheetGrabberVisible: true,
                    }}
                >
                    <Stack.Header transparent />
                    <Stack.Screen.Title>{t("nav.search")}</Stack.Screen.Title>
                </Stack.Screen>

                <Stack.Screen
                    name="paywall"
                    options={{
                        presentation: "modal",
                        sheetGrabberVisible: true,
                        title: "",
                    }}
                >
                    <Stack.Header transparent />
                </Stack.Screen>

                {TITLED_SCREENS.map((screen) => (
                    <Stack.Screen key={screen.name} name={screen.name}>
                        <Stack.Header transparent />
                        <Stack.Screen.BackButton displayMode="minimal" />
                        <Stack.Screen.Title>{t(screen.titleKey)}</Stack.Screen.Title>
                    </Stack.Screen>
                ))}
                <Stack.Screen name="accounts/reorder" />
                <Stack.Screen name="accounts/[accountId]/index" />
                <Stack.Screen name="settings/categories/reorder" />
                <Stack.Screen name="settings/licenses/[name]" />
                {SHEET_SCREENS.map((sheet) => (
                    <Stack.Screen
                        key={sheet.name}
                        name={sheet.name}
                        options={{
                            presentation: "formSheet",
                            sheetAllowedDetents: [sheet.detent, 1],
                            sheetGrabberVisible: true,
                            title: t(sheet.titleKey),
                        }}
                    >
                        <Stack.Header transparent />
                        <Stack.Screen.BackButton displayMode="minimal" />
                        <Stack.Screen.Title>{t(sheet.titleKey)}</Stack.Screen.Title>
                    </Stack.Screen>
                ))}
                <Stack.Screen
                    name="settings/category-symbol"
                    options={{
                        headerShown: false,
                        presentation: "formSheet",
                        sheetAllowedDetents: [pickerDetent, 1],
                        sheetCornerRadius: 40,
                        sheetGrabberVisible: true,
                    }}
                />

                {MODAL_SCREENS.map((modal) => (
                    <Stack.Screen key={modal.name} name={modal.name} options={{ presentation: "modal" }}>
                        <Stack.Header transparent />
                        <Stack.Screen.BackButton displayMode="minimal" />
                        <Stack.Screen.Title>{t(modal.titleKey)}</Stack.Screen.Title>
                    </Stack.Screen>
                ))}
                <Stack.Screen name="transactions/[id]" options={{ presentation: "formSheet", title: "" }}>
                    <Stack.Header transparent />
                </Stack.Screen>
                <Stack.Screen name="transactions/transfers/[id]" options={{ presentation: "formSheet", title: "" }}>
                    <Stack.Header transparent />
                </Stack.Screen>
                <Stack.Screen name="transactions/voice" options={{ headerShown: false, presentation: "modal" }} />
                <Stack.Screen name="transactions/scan" options={{ headerShown: false, presentation: "modal" }} />
                <Stack.Screen
                    name="transactions/identity"
                    options={{
                        headerShown: false,
                        presentation: "formSheet",
                        sheetAllowedDetents: [pickerDetent, 1],
                        sheetCornerRadius: 40,
                        sheetGrabberVisible: true,
                        sheetLargestUndimmedDetentIndex: 0,
                    }}
                />
            </Stack.Protected>
        </Stack>
    );
}

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        GeistMono_400Regular,
        GeistMono_500Medium,
        InstrumentSerif_400Regular,
    });

    return (
        <SafeAreaProvider>
            <SafeAreaListener
                onChange={({ insets }) => {
                    Uniwind.updateInsets(insets);
                }}
            >
                <PanelUIProvider>
                    <LanguageProvider>
                        <CloudRuntimeProvider>
                            <LocalDataProvider>
                                <DeferredDeleteProvider>
                                    <AppSettingsProvider>
                                        <IdentityDraftProvider>
                                            <RootNavigator fontsLoaded={fontsLoaded} />
                                        </IdentityDraftProvider>
                                    </AppSettingsProvider>
                                </DeferredDeleteProvider>
                            </LocalDataProvider>
                        </CloudRuntimeProvider>
                    </LanguageProvider>
                </PanelUIProvider>
            </SafeAreaListener>
        </SafeAreaProvider>
    );
}
