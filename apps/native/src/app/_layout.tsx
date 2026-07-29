import "../../global.css";
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
import { useEffect } from "react";
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
import { convex } from "@/lib/convex";
import {
	CATEGORY_DETENT,
	identityPickerDetent,
	SUBCATEGORY_DETENT,
} from "@/lib/sheet-detents";

preventAutoHideAsync();

export const unstable_settings = {
	anchor: "(tabs)",
};

/**
 * Settings subscreens live outside `(tabs)` so pushing one drops the tab bar,
 * and on the root stack rather than a nested one so it keeps a back button.
 * `categories/index` is absent because it declares its own chrome.
 */
const SETTINGS_SCREENS: readonly { name: string; title: string }[] = [
	{ name: "settings/about", title: "About & Credits" },
	{ name: "settings/app-icon", title: "App Icon" },
	{ name: "settings/currency", title: "Currency" },
	{ name: "settings/erase", title: "Erase Data" },
	{ name: "settings/export", title: "Export Data" },
	{ name: "settings/feature-lab", title: "Feature Lab" },
	{ name: "settings/haptics", title: "Haptics" },
	{ name: "settings/import", title: "Import Data" },
	{ name: "settings/notifications", title: "Notifications" },
	{ name: "settings/number-entry", title: "Number Entry" },
	{ name: "settings/theme", title: "Theme" },
	{ name: "settings/time", title: "Time Frames" },
	{ name: "settings/upcoming", title: "Upcoming Logs" },
];

const CATEGORY_SHEETS: readonly {
	name: string;
	title: string;
	detent: number;
}[] = [
	{
		name: "settings/categories/create",
		title: "New Category",
		detent: CATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/index",
		title: "Edit Category",
		detent: CATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/subcategories/create",
		title: "New Subcategory",
		detent: SUBCATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/subcategories/[subcategoryId]",
		title: "Subcategory",
		detent: SUBCATEGORY_DETENT,
	},
];

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
	return (
		<View className="flex-1 items-center justify-center bg-background px-8">
			<Text className="pb-2 font-sans-semibold text-foreground text-title">
				Something Went Wrong
			</Text>
			<Text className="pb-4 text-center text-muted text-subtitle">
				Outlayr hit an unexpected error. Your data is untouched — try again.
			</Text>
			<Text className="pb-6 text-center text-label text-muted">
				{error.message}
			</Text>
			<Pressable
				className="rounded-full bg-accent px-6 py-3"
				onPress={() => {
					retry();
				}}
			>
				<Text className="font-sans-semibold text-accent-foreground text-subtitle">
					Try Again
				</Text>
			</Pressable>
		</View>
	);
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
	const { status } = useLocalData();
	const { isDark, isHydrated: themeReady } = useAppTheme();
	const colorScheme = useColorScheme();

	// The app's one readiness gate: every screen below it can call `useDatabase()`
	// and read straight away, with no per-screen loading branch, and the first
	// frame is already in the user's chosen theme. "error" drops the splash too —
	// an error surface beats an indefinite splash.
	const isReady =
		fontsLoaded && themeReady && (status === "ready" || status === "error");

	useEffect(() => {
		if (isReady) {
			hideAsync();
		}
	}, [isReady]);

	if (!isReady) {
		return null;
	}

	if (status === "error") {
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
				<AppLockGate>
					<RootStack />
				</AppLockGate>
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
	const onboarded = useOnboardingSettled(db);
	const { height: windowHeight } = useWindowDimensions();
	const pickerDetent = identityPickerDetent(windowHeight);

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

			<Stack.Protected guard={onboarded}>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			</Stack.Protected>

			<Stack.Screen
				name="search"
				options={{
					presentation: "modal",
					title: "Search",
					sheetGrabberVisible: true,
				}}
			/>

			{SETTINGS_SCREENS.map((screen) => (
				<Stack.Screen key={screen.name} name={screen.name}>
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{screen.title}</Stack.Screen.Title>
				</Stack.Screen>
			))}
			<Stack.Screen name="settings/categories/index">
				<Stack.Header transparent />
				<Stack.Screen.BackButton displayMode="minimal" />
				<Stack.Screen.Title>Categories</Stack.Screen.Title>
			</Stack.Screen>
			{CATEGORY_SHEETS.map((sheet) => (
				<Stack.Screen
					key={sheet.name}
					name={sheet.name}
					options={{
						presentation: "formSheet",
						title: sheet.title,
						sheetAllowedDetents: [sheet.detent, 1],
						sheetGrabberVisible: true,
					}}
				>
					<Stack.Header transparent />
					<Stack.Screen.BackButton displayMode="minimal" />
					<Stack.Screen.Title>{sheet.title}</Stack.Screen.Title>
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
				options={{ presentation: "modal", title: "New Transaction" }}
			/>
			<Stack.Screen
				name="transaction/[id]"
				options={{ presentation: "modal", title: "Edit Transaction" }}
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

/** A local-first ledger must not fail to start over a missing rates URL. */
function ConvexShell({ children }: { children: React.ReactNode }) {
	if (!convex) {
		return children;
	}
	return <ConvexProvider client={convex}>{children}</ConvexProvider>;
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
							<ConvexShell>
								<LocalDataProvider>
									<IdentityDraftProvider>
										<RootNavigator fontsLoaded={fontsLoaded} />
									</IdentityDraftProvider>
								</LocalDataProvider>
							</ConvexShell>
						</AppThemeProvider>
					</SafeAreaListener>
				</SafeAreaProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
