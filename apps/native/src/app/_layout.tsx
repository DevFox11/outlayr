import "../../global.css";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import {
	GeistMono_400Regular,
	GeistMono_500Medium,
	useFonts,
} from "@expo-google-fonts/geist-mono";
import { ConvexProvider } from "convex/react";
import type { ErrorBoundaryProps } from "expo-router";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { hideAsync, preventAutoHideAsync } from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
	Pressable,
	useColorScheme,
	useWindowDimensions,
	View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
	SafeAreaListener,
	SafeAreaProvider,
} from "react-native-safe-area-context";
import { Uniwind } from "uniwind";
import { AppLockGate } from "@/components/app-lock-gate";
import { AuthCover } from "@/components/auth-cover";
import { LocalDataError } from "@/components/local-data-error";
import { Text } from "@/components/text";
import { AppThemeProvider, useAppTheme } from "@/contexts/app-theme-context";
import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import {
	LocalDataProvider,
	useDatabase,
	useLocalData,
} from "@/contexts/local-data-context";
import { useOnboardingSettled } from "@/data/onboarding";
import { useSeededClockPreference } from "@/data/settings";
import { authRoute } from "@/domain/auth-gate";
import {
	LanguageProvider,
	type TranslationKey,
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
import {
	CATEGORY_DETENT,
	identityPickerDetent,
	SUBCATEGORY_DETENT,
} from "@/lib/sheet-detents";
import { useSubscriptionReminderSync } from "@/lib/subscription-reminder-sync";

preventAutoHideAsync();

export const unstable_settings = {
	anchor: "(tabs)",
};

/**
 * Settings subscreens live outside `(tabs)` so pushing one drops the tab bar,
 * and on the root stack rather than a nested one so it keeps a back button.
 * `categories/index` is absent because it declares its own chrome.
 */
const SETTINGS_SCREENS: readonly { name: string; titleKey: TranslationKey }[] =
	[
		{ name: "settings/about", titleKey: "nav.settings.about" },
		{ name: "settings/account", titleKey: "nav.settings.account" },
		{ name: "settings/app-icon", titleKey: "nav.settings.appIcon" },
		{ name: "settings/currency", titleKey: "nav.settings.currency" },
		{ name: "settings/deleted", titleKey: "settings.deleted.navTitle" },
		{ name: "settings/erase", titleKey: "nav.settings.erase" },
		{ name: "settings/export", titleKey: "nav.settings.export" },
		{ name: "settings/feature-lab", titleKey: "nav.settings.featureLab" },
		{ name: "settings/haptics", titleKey: "nav.settings.haptics" },
		{ name: "settings/import", titleKey: "nav.settings.import" },
		{ name: "settings/language", titleKey: "nav.settings.language" },
		{ name: "settings/notifications", titleKey: "nav.settings.notifications" },
		{ name: "settings/number-entry", titleKey: "nav.settings.numberEntry" },
		{ name: "settings/sync", titleKey: "settings.sync.navTitle" },
		{ name: "settings/theme", titleKey: "nav.settings.theme" },
		{ name: "settings/time", titleKey: "nav.settings.time" },
		{ name: "settings/upcoming", titleKey: "nav.settings.upcoming" },
	];

const CATEGORY_SHEETS: readonly {
	name: string;
	titleKey: TranslationKey;
	detent: number;
}[] = [
	{
		name: "settings/categories/create",
		titleKey: "nav.newCategory",
		detent: CATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/index",
		titleKey: "nav.editCategory",
		detent: CATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/subcategories/create",
		titleKey: "nav.newSubcategory",
		detent: SUBCATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/subcategories/[subcategoryId]",
		titleKey: "nav.subcategory",
		detent: SUBCATEGORY_DETENT,
	},
];

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
	const { isDark, isHydrated: themeReady } = useAppTheme();
	const languageReady = useLanguageReady();
	const colorScheme = useColorScheme();
	const [splashHidden, setSplashHidden] = useState(false);

	// The app's one readiness gate: every screen below it can call `useDatabase()`
	// and read straight away, with no per-screen loading branch, and the first
	// frame is already in the user's chosen theme and language. "error" drops the
	// splash too — an error surface beats an indefinite splash.
	const isReady =
		fontsLoaded &&
		themeReady &&
		languageReady &&
		(status === "ready" || status === "error");

	useEffect(() => {
		if (isReady) {
			hideAsync();
			setSplashHidden(true);
		}
	}, [isReady]);

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

			{/* expo-router derives every header's native
			    `UINavigationBar.overrideUserInterfaceStyle` from this theme's `dark`
			    flag, never from the device. Without it the bar is pinned light and
			    renders light-mode Liquid Glass over dark content. */}
			<ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
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
 * Split from `RootNavigator` so `useDatabase` is only ever called below the
 * splash gate, where the database is guaranteed open.
 */
function RootStack() {
	const db = useDatabase();
	const t = useTranslation();
	const onboarded = useOnboardingSettled(db);
	const { gate } = useAuthSession();
	const { status: adoption } = useLedgerAdoption();
	const { height: windowHeight } = useWindowDimensions();
	const pickerDetent = identityPickerDetent(windowHeight);
	useSubscriptionReminderSync(db);
	useSeededClockPreference(db);

	const route = authRoute(gate, adoption === "settled");

	return (
		<Stack>
			{/* Declared before `(tabs)`: with the anchor guarded away on a first run,
			    the stack opens on whatever screen is left first. */}
			<Stack.Protected guard={!onboarded}>
				<Stack.Screen
					name="onboarding/index"
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name="onboarding/currency"
					options={{ headerShown: false }}
				/>
			</Stack.Protected>

			{/* Behind onboarding, not in front of it: the currency step is the only
			    thing that writes `currencyChosen`, and canonicalization declines
			    every row on a ledger that lacks it (`docs/convex-sync-design.md`
			    §1.7). A device has to state its currency before it holds a ledger,
			    not after an account has handed it one. */}
			<Stack.Protected guard={onboarded && route === "sign-in"}>
				<Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
			</Stack.Protected>

			<Stack.Protected guard={onboarded && route === "adopt"}>
				<Stack.Screen
					name="auth/adopt"
					options={{ headerShown: false, gestureEnabled: false }}
				/>
			</Stack.Protected>

			<Stack.Protected guard={onboarded && route === "ledger"}>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			</Stack.Protected>

			<Stack.Screen
				name="search"
				options={{
					presentation: "modal",
					title: t("nav.search"),
					sheetGrabberVisible: true,
				}}
			/>

			{SETTINGS_SCREENS.map((screen) => (
				<Stack.Screen key={screen.name} name={screen.name}>
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{t(screen.titleKey)}</Stack.Screen.Title>
				</Stack.Screen>
			))}
			<Stack.Screen name="settings/categories/index">
				<Stack.Header transparent />
				<Stack.Screen.BackButton displayMode="minimal" />
				<Stack.Screen.Title>{t("nav.categories")}</Stack.Screen.Title>
			</Stack.Screen>
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
					sheetLargestUndimmedDetentIndex: 0,
					sheetCornerRadius: 40,
					contentStyle: { backgroundColor: "transparent" },
				}}
			/>

			<Stack.Screen
				name="transaction/new"
				options={{ presentation: "modal", title: t("nav.newTransaction") }}
			/>
			<Stack.Screen
				name="transaction/[id]"
				options={{ presentation: "modal", title: t("nav.editTransaction") }}
			/>
			<Stack.Screen
				name="transaction/identity"
				options={{
					presentation: "formSheet",
					headerShown: false,
					sheetGrabberVisible: true,
					sheetAllowedDetents: [pickerDetent, 1],
					sheetLargestUndimmedDetentIndex: 0,
					sheetCornerRadius: 40,
					contentStyle: { backgroundColor: "transparent" },
				}}
			/>
		</Stack>
	);
}

/**
 * A local-first ledger must not fail to start over a missing rates URL, nor over
 * an unconfigured account: each provider is only mounted once its own
 * prerequisite is present, so the fallback all the way down is a working app
 * with no backend rather than a crash.
 */
function ConvexShell({ children }: { children: React.ReactNode }) {
	if (!convex) {
		return children;
	}
	if (!authClient) {
		return <ConvexProvider client={convex}>{children}</ConvexProvider>;
	}
	return (
		<ConvexBetterAuthProvider authClient={authClient} client={convex}>
			{children}
		</ConvexBetterAuthProvider>
	);
}

export default function RootLayout() {
	const [fontsLoaded] = useFonts({
		GeistMono_400Regular,
		GeistMono_500Medium,
	});

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<KeyboardProvider statusBarTranslucent>
				<SafeAreaProvider>
					{/* Feeds the live insets to uniwind — without it every `*-safe`
					    utility resolves to nothing. */}
					<SafeAreaListener
						onChange={({ insets }) => {
							Uniwind.updateInsets(insets);
						}}
					>
						<AppThemeProvider>
							<LanguageProvider>
								<ConvexShell>
									<AuthSessionProvider>
										<LocalDataProvider>
											<IdentityDraftProvider>
												<RootNavigator fontsLoaded={fontsLoaded} />
											</IdentityDraftProvider>
										</LocalDataProvider>
									</AuthSessionProvider>
								</ConvexShell>
							</LanguageProvider>
						</AppThemeProvider>
					</SafeAreaListener>
				</SafeAreaProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
