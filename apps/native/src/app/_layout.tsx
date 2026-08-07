import "../../global.css";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import {
	GeistMono_400Regular,
	GeistMono_500Medium,
	useFonts,
} from "@expo-google-fonts/geist-mono";
import type { ErrorBoundaryProps } from "expo-router";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { hideAsync, preventAutoHideAsync } from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PanelUIProvider, useTheme } from "panelui-native";
import { useEffect, useState } from "react";
import {
	Pressable,
	useColorScheme,
	useWindowDimensions,
	View,
} from "react-native";
import {
	SafeAreaListener,
	SafeAreaProvider,
} from "react-native-safe-area-context";
import { Uniwind, useCSSVariable } from "uniwind";

import { AppLockGate } from "@/components/app-lock-gate";
import { AuthCover } from "@/components/auth-cover";
import { LocalDataError } from "@/components/local-data-error";
import { Text } from "@/components/text";
import { AppSettingsProvider } from "@/contexts/display-settings-context";
import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import {
	LocalDataProvider,
	useDatabase,
	useLocalData,
} from "@/contexts/local-data-context";
import { useAccountDeferred, useOnboardingSettled } from "@/data/onboarding";
import { useSeededClockPreference } from "@/data/settings";
import { rootStackGroup } from "@/domain/auth-gate";
import { CATEGORY_SHEETS, SETTINGS_SCREENS } from "@/domain/root-stack";
import {
	LanguageProvider,
	translateNow,
	useLanguageReady,
	useTranslation,
} from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { AuthSessionProvider, useAuthSession } from "@/lib/auth-session";
import { convex } from "@/lib/convex";
import {
	LedgerAdoptionProvider,
	useLedgerAdoption,
} from "@/lib/ledger-adoption";
import { ACCOUNT_DETENT, identityPickerDetent } from "@/lib/sheet-detents";
import { useSubscriptionReminderSync } from "@/lib/subscription-reminder-sync";

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
		<View className="flex-1 items-center justify-center bg-background px-8">
			<Text className="pb-2 font-sans-semibold text-foreground text-title">
				{translateNow("error.boundary.title")}
			</Text>
			<Text className="pb-4 text-center text-muted text-subtitle">
				{translateNow("error.boundary.body")}
			</Text>
			<Text className="pb-6 text-center text-label text-muted">
				{error.message}
			</Text>
			<Pressable
				accessibilityRole="button"
				className="rounded-full bg-accent px-6 py-3"
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

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
	const { status } = useLocalData();
	const { theme } = useTheme();
	const isDark = theme === "dark";
	const languageReady = useLanguageReady();
	const colorScheme = useColorScheme();
	const [splashHidden, setSplashHidden] = useState(false);
	const [background, card, text, border] = useCSSVariable([
		"--color-background",
		"--color-card",
		"--color-foreground",
		"--color-border",
	]) as string[];

	// The app's one readiness gate: every screen below it can call `useDatabase()`
	// and read straight away, with no per-screen loading branch, and the first
	// frame is already in the user's language. "error" drops the splash too — an
	// error surface beats an indefinite splash.
	const isReady =
		fontsLoaded && languageReady && (status === "ready" || status === "error");

	useEffect(() => {
		if (isReady) {
			hideAsync();
			setSplashHidden(true);
		}
	}, [isReady]);

	const base = isDark ? DarkTheme : DefaultTheme;

	// Latched on the splash, because `retry()` walks the status back through
	// opening → migrating → seeding: returning null on those once the splash is
	// gone would blank the screen for the length of the attempt, and permanently
	// if the migration never answers on a locked or corrupt file.
	if (!isReady && !splashHidden) {
		return null;
	}

	if (status !== "ready") {
		return <LocalDataError />;
	}

	return (
		<>
			<StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

			<ThemeProvider
				value={{
					...base,
					dark: isDark,
					colors: { ...base.colors, background, card, text, border },
				}}
			>
				<LedgerAdoptionProvider>
					<AuthCover>
						<AppLockGate>
							<RootStack />
						</AppLockGate>
					</AuthCover>
				</LedgerAdoptionProvider>
			</ThemeProvider>
		</>
	);
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
		onboarded,
		gate,
		reconciled: adoption === "settled",
		deferred,
	});

	return (
		<Stack>
			{/* Declared before `(tabs)`: with the anchor guarded away on a first run,
			    the stack opens on whatever screen is left first. */}
			<Stack.Protected guard={group === "onboarding"}>
				<Stack.Screen
					name="onboarding/index"
					options={{ headerShown: false }}
				/>
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
				<Stack.Screen
					name="auth/adopt"
					options={{ headerShown: false, gestureEnabled: false }}
				/>
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

				{SETTINGS_SCREENS.map((screen) => (
					<Stack.Screen key={screen.name} name={screen.name}>
						<Stack.Header transparent />
						<Stack.Screen.BackButton displayMode="minimal" />
						<Stack.Screen.Title>{t(screen.titleKey)}</Stack.Screen.Title>
					</Stack.Screen>
				))}
				<Stack.Screen name="settings/accounts/index">
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{t("accounts.title")}</Stack.Screen.Title>
				</Stack.Screen>
				<Stack.Screen name="settings/accounts/reorder" />
				<Stack.Screen name="settings/accounts/[accountId]/index" />
				<Stack.Screen
					name="settings/accounts/create"
					options={{
						presentation: "formSheet",
						title: t("accounts.nav.new"),
						sheetAllowedDetents: [ACCOUNT_DETENT, 1],
						sheetGrabberVisible: true,
					}}
				>
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{t("accounts.nav.new")}</Stack.Screen.Title>
				</Stack.Screen>
				<Stack.Screen
					name="settings/accounts/[accountId]/edit"
					options={{
						presentation: "formSheet",
						title: t("accounts.nav.edit"),
						sheetAllowedDetents: [ACCOUNT_DETENT, 1],
						sheetGrabberVisible: true,
					}}
				>
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{t("accounts.nav.edit")}</Stack.Screen.Title>
				</Stack.Screen>
				<Stack.Screen name="settings/categories/index">
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{t("nav.categories")}</Stack.Screen.Title>
				</Stack.Screen>
				<Stack.Screen name="settings/categories/reorder" />
				{CATEGORY_SHEETS.map((sheet) => (
					<Stack.Screen
						key={sheet.name}
						name={sheet.name}
						options={{
							presentation: "formSheet",
							title: t(sheet.titleKey),
							sheetAllowedDetents: [sheet.detent, 1],
							sheetGrabberVisible: true,
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
						presentation: "formSheet",
						headerShown: false,
						sheetGrabberVisible: true,
						sheetAllowedDetents: [pickerDetent, 1],
						sheetCornerRadius: 40,
					}}
				/>

				<Stack.Screen
					name="transactions/create"
					options={{ presentation: "modal" }}
				>
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{t("nav.newTransaction")}</Stack.Screen.Title>
				</Stack.Screen>
				<Stack.Screen
					name="transactions/[id]"
					options={{ presentation: "modal" }}
				>
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{t("nav.editTransaction")}</Stack.Screen.Title>
				</Stack.Screen>
				<Stack.Screen
					name="transactions/identity"
					options={{
						presentation: "formSheet",
						headerShown: false,
						sheetGrabberVisible: true,
						sheetAllowedDetents: [pickerDetent, 1],
						sheetLargestUndimmedDetentIndex: 0,
						sheetCornerRadius: 40,
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
						<ConvexBetterAuthProvider authClient={authClient} client={convex}>
							<AuthSessionProvider>
								<LocalDataProvider>
									<AppSettingsProvider>
										<IdentityDraftProvider>
											<RootNavigator fontsLoaded={fontsLoaded} />
										</IdentityDraftProvider>
									</AppSettingsProvider>
								</LocalDataProvider>
							</AuthSessionProvider>
						</ConvexBetterAuthProvider>
					</LanguageProvider>
				</PanelUIProvider>
			</SafeAreaListener>
		</SafeAreaProvider>
	);
}
