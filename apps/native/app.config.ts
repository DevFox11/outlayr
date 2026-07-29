import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

const isProduction = process.env.EAS_BUILD_PROFILE === "production";

/**
 * The one literal for the shared container. It is declared here and read back
 * everywhere else — `extra` carries it to the JS runtime and the intents target
 * config lifts it off `ios.entitlements` — so the app and its extensions can
 * never drift onto different groups, which fails silently as an intent whose
 * work never arrives rather than as a build error.
 */
const APP_GROUP = "group.com.tryoutlayr.app";

/**
 * The app's iOS floor. Every consumer has to be told separately:
 * `expo-build-properties` floors the app target and the pods,
 * `expo-target.config.js` floors the intents extension, and `ios.deploymentTarget`
 * below is what `expo-widgets` reads for its widget extension.
 */
const IOS_DEPLOYMENT_TARGET = "18.0";

/**
 * Alternate home-screen icons, by asset-catalogue name. `setAlternateIconName`
 * takes one of these strings, so `src/domain/app-icons.ts` has to repeat them —
 * this file is transpiled and loaded on its own and cannot import from `src/`.
 * `app-icons.test.ts` fails when the two lists or the bundles on disk drift.
 */
const ALTERNATE_ICONS = [
	"OutlayrInk",
	"OutlayrHairline",
	"OutlayrMono",
	"OutlayrEmboss",
];

/**
 * The home and Lock Screen surfaces. `name` is the contract with
 * `createWidget(name, …)` in `src/widgets/` — they must match exactly or the
 * layout never reaches its target.
 *
 * Each widget is offered only the families it was actually composed for. A
 * layout stretched into a size it was not designed for is how the Grid hierarchy
 * (one hero figure, one supporting rank) collapses into evenly-spaced mush, so
 * the ledger has no small variant — its rows need the width.
 *
 * An accessory family is a separate composition rather than a smaller tile: the
 * system flattens it to a single tint and allows a couple of lines. A widget
 * offered one has to branch on it, which `src/widgets/families.test.ts` enforces
 * against this list.
 */
const WIDGETS = [
	{
		name: "Log",
		displayName: "Log an Expense",
		description: "Today's spending, and one tap to add an entry.",
		ios: {
			supportedFamilies: [
				"systemSmall",
				"accessoryCircular",
				"accessoryRectangular",
				"accessoryInline",
			],
		},
	},
	{
		name: "Budget",
		displayName: "Budget",
		description:
			"What is left in your overall budget, and how far into the period you are.",
		ios: {
			supportedFamilies: [
				"systemSmall",
				"systemMedium",
				"accessoryCircular",
				"accessoryRectangular",
				"accessoryInline",
			],
			// Every case has to exist in the published props before the tile can be
			// pinned to it — see `BudgetWidgetProps.views`. The values are the keys
			// of that record, and `expo-widgets` requires them to be Swift
			// identifiers because each becomes an `AppEnum` case.
			configuration: {
				title: "Budget",
				parameters: {
					budget: {
						title: "Budget",
						type: "enum",
						values: [
							{ name: "Automatic", value: "auto" },
							{ name: "Overall budget", value: "overall" },
							{ name: "Closest to its limit", value: "worst" },
						],
						default: "auto",
					},
				},
			},
		},
	},
	{
		name: "Ledger",
		displayName: "Recent Entries",
		description: "Your most recent entries, newest first.",
		ios: {
			supportedFamilies: [
				"systemMedium",
				"systemLarge",
				"accessoryRectangular",
				"accessoryInline",
			],
		},
	},
	{
		name: "Insights",
		displayName: "Insights",
		description:
			"Spend, income and net for the period, with where the money went.",
		ios: {
			supportedFamilies: ["systemSmall", "systemMedium"],
			configuration: {
				title: "Insights",
				parameters: {
					period: {
						title: "Period",
						type: "enum",
						values: [
							{ name: "Match the app", value: "app" },
							{ name: "This week", value: "week" },
							{ name: "This month", value: "month" },
							{ name: "This year", value: "year" },
						],
						default: "app",
					},
				},
			},
		},
	},
];

// SF Pro Rounded gives the RN layer the same face SwiftUI gets from
// `.system(design: .rounded)`. The OTFs are Apple-licensed and not committed,
// so only the ones actually present get bundled — a missing file must never
// break `expo prebuild`. See assets/fonts/README.md for the drop-in list.
const roundedFontFiles = [
	"SF-Pro-Rounded-Regular.otf",
	"SF-Pro-Rounded-Medium.otf",
	"SF-Pro-Rounded-Semibold.otf",
	"SF-Pro-Rounded-Bold.otf",
];
const roundedFonts = roundedFontFiles
	.map((file) => `./assets/fonts/${file}`)
	.filter((relPath) => existsSync(join(__dirname, relPath)));

if (roundedFonts.length === 0) {
	console.warn(
		"[outlayr] No SF Pro Rounded OTFs in assets/fonts — nothing will be embedded, " +
			"yet every <Text> asks for SFProRounded-*. iOS falls back to the system face " +
			"with no error, so this build renders in the wrong typeface. " +
			"See assets/fonts/README.md.",
	);
}

const GOOGLE_CLIENT_SUFFIX = /\.apps\.googleusercontent\.com$/i;

/**
 * Google's iOS SDK is handed back through a URL scheme that is the client id
 * reversed, and the config plugin rejects anything that is not one — including
 * an absent id, which is why an unconfigured build still gets a syntactically
 * valid placeholder rather than failing `expo prebuild`. Sign-in is guarded
 * separately at runtime by `isGoogleSignInAvailable`.
 */
function googleIosUrlScheme(clientId: string | undefined): string {
	if (!clientId) {
		return "com.googleusercontent.apps.placeholder";
	}
	if (clientId.startsWith("com.googleusercontent.apps.")) {
		return clientId;
	}
	return `com.googleusercontent.apps.${clientId.replace(GOOGLE_CLIENT_SUFFIX, "")}`;
}

const getConfig = ({ config }: ConfigContext): ExpoConfig => {
	return {
		...config,
		name: "Outlayr",
		slug: "outlayr",
		owner: "danestves-llc",
		orientation: "default",
		userInterfaceStyle: "automatic",
		scheme: "outlayr",
		extra: {
			appGroup: APP_GROUP,
			eas: {
				projectId: "f076a9e9-ec12-464d-85eb-772c4d0efce5",
			},
		},
		plugins: [
			"expo-router",
			"expo-localization",
			[
				"expo-build-properties",
				{
					ios: {
						deploymentTarget: IOS_DEPLOYMENT_TARGET,
					},
				},
			],
			["expo-font", { fonts: roundedFonts }],
			[
				"expo-widgets",
				{
					groupIdentifier: APP_GROUP,
					widgets: WIDGETS,
				},
			],
			// Only the App Intents target. Widgets are `expo-widgets` above — Siri
			// phrases and Shortcuts actions are the one surface it does not cover,
			// and an `AppIntent` has to be compiled Swift in a real target.
			"@bacons/apple-targets",
			// Patches the AppDelegate to open a tapped Spotlight result's identifier
			// as a URL. It hooks `application(_:continue:restorationHandler:)`, which
			// the SceneDelegate in `with-ui-scene` forwards to for both a warm
			// `scene(_:continue:)` and a cold-start `connectionOptions.userActivities`
			// — so unlike quick actions, adopting scenes does not strand it.
			"expo-core-spotlight",
			// Static so the actions exist before the app has ever been opened, which
			// is the whole point of a quick action. `href` is a full `outlayr://`
			// URL, not a router path: the SceneDelegate in `with-ui-scene` opens it
			// as a link, so these arrive through `+native-intent` alongside the
			// widgets and Siri instead of needing a second routing mechanism.
			[
				"expo-quick-actions",
				{
					iosActions: [
						{
							id: "log-expense",
							title: "Log Expense",
							icon: "symbol:plus.circle.fill",
							params: { href: "outlayr://new" },
						},
						{
							id: "log-income",
							title: "Log Income",
							icon: "symbol:arrow.down.circle.fill",
							params: { href: "outlayr://new?income=1" },
						},
						{
							id: "search",
							title: "Search Entries",
							icon: "symbol:magnifyingglass",
							params: { href: "outlayr://search" },
						},
						{
							id: "budgets",
							title: "Budgets",
							icon: "symbol:chart.pie.fill",
							params: { href: "outlayr://budgets" },
						},
					],
				},
			],
			[
				"expo-splash-screen",
				{
					backgroundColor: "#ffffff",
					image: "./assets/images/splash-icon.png",
					dark: {
						image: "./assets/images/splash-icon-dark.png",
						backgroundColor: "#060a07",
					},
					imageWidth: 200,
				},
			],
			"expo-system-ui",
			"expo-apple-authentication",
			"expo-secure-store",
			"expo-web-browser",
			[
				"react-native-nitro-google-signin",
				{
					iosUrlScheme: googleIosUrlScheme(
						process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
					),
				},
			],
			[
				"expo-image-picker",
				{
					photosPermission:
						"Outlayr uses your photos to set a custom logo for a transaction.",
					cameraPermission: false,
				},
			],
			[
				"expo-local-authentication",
				{
					faceIDPermission: "Outlayr uses Face ID to unlock your ledger.",
				},
			],
			[
				"./plugins/with-alternate-icons.ts",
				{
					icons: ALTERNATE_ICONS.map((name) => `./assets/${name}.icon`),
				},
			],
			"./plugins/with-ui-scene.ts",
			"./plugins/with-min-pod-deployment-target.ts",
		],
		experiments: {
			typedRoutes: true,
			reactCompiler: true,
		},
		ios: {
			bundleIdentifier: "com.tryoutlayr.app",
			// Read by both target plugins to stamp `DEVELOPMENT_TEAM` on the widget
			// and intents extensions. Without it they generate unsigned, so a device
			// or EAS build cannot embed them.
			appleTeamId: "8ZB3YXDU7V",
			// Not in the ExpoConfig schema — hence the assertion below — but it is
			// what `expo-widgets` reads to pick its widget extension's floor, and
			// its own default of 16.4 cannot link the `ExpoWidgets` pod (built at
			// 18.0). Leaving it unset fails the build, not the config validation.
			deploymentTarget: IOS_DEPLOYMENT_TARGET,
			icon: isProduction
				? "./assets/Outlayr.icon"
				: "./assets/OutlayrTesting.icon",
			usesAppleSignIn: true,
			entitlements: {
				// An extension runs in its own process and cannot reach the app's
				// container. `expo-widgets` uses this group for its own transport;
				// `targets/intents` uses it for the two things Siri needs — the figures
				// it reads out, and the queue it leaves work in. Both target configs
				// mirror the value from here rather than repeating it.
				"com.apple.security.application-groups": [APP_GROUP],
			},
			infoPlist: {
				ITSAppUsesNonExemptEncryption: false,
				// Without these iOS offers no per-app language row in Settings and
				// reports the device language even when the app cannot render it.
				CFBundleLocalizations: ["en", "es"],
			},
		},
		android: {
			package: "com.tryoutlayr.app",
			adaptiveIcon: {
				foregroundImage: "./assets/images/adaptive-icon.png",
				backgroundColor: "#f2f0ea",
			},
		},
	};
};

export default getConfig;
