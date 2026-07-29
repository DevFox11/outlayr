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
 * The home and Lock Screen surfaces. `name` is the contract with
 * `createWidget(name, …)` in `src/widgets/` — they must match exactly or the
 * layout never reaches its target.
 *
 * Each widget is offered only the families it was actually composed for. A
 * layout stretched into a size it was not designed for is how the Grid hierarchy
 * (one hero figure, one supporting rank) collapses into evenly-spaced mush, so
 * the ledger has no small variant and the accessory families belong to Budget,
 * which is the only thing worth a glance from the Lock Screen.
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
		},
	},
	{
		name: "Ledger",
		displayName: "Recent Entries",
		description: "Your most recent entries, newest first.",
		ios: { supportedFamilies: ["systemMedium", "systemLarge"] },
	},
	{
		name: "Insights",
		displayName: "Insights",
		description:
			"Spend, income and net for the period, with where the money went.",
		ios: { supportedFamilies: ["systemSmall", "systemMedium"] },
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
			[
				"expo-image-picker",
				{
					photosPermission:
						"Outlayr uses your photos to set a custom logo for a transaction.",
					cameraPermission: false,
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
