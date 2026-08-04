import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

const isProduction = process.env.EAS_BUILD_PROFILE === "production";

const APP_GROUP = "group.com.tryoutlayr.app";

const IOS_DEPLOYMENT_TARGET = "18.0";

const ALTERNATE_ICONS = [
	"OutlayrInk",
	"OutlayrHairline",
	"OutlayrMono",
	"OutlayrEmboss",
];

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
			configuration: {
				title: "Recent Entries",
				parameters: {
					period: {
						title: "Period",
						type: "enum",
						values: [
							{ name: "Today", value: "today" },
							{ name: "This week", value: "week" },
							{ name: "This month", value: "month" },
							{ name: "This year", value: "year" },
						],
						default: "today",
					},
					measure: {
						title: "Figure",
						type: "enum",
						values: [
							{ name: "Spent", value: "spent" },
							{ name: "Income", value: "income" },
							{ name: "Net", value: "net" },
						],
						default: "spent",
					},
				},
			},
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
			primaryAppIcon: isProduction ? "Outlayr" : "OutlayrTesting",
			eas: {
				projectId: "f076a9e9-ec12-464d-85eb-772c4d0efce5",
			},
		},
		plugins: [
			"expo-router",
			"expo-localization",
			"expo-image",
			"expo-sqlite",
			"expo-status-bar",
			"expo-sharing",
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
			"@bacons/apple-targets",
			"expo-core-spotlight",
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
			"expo-alternate-app-icons",
			"./plugins/with-ui-scene.ts",
			"./plugins/with-min-pod-deployment-target.ts",
			["./plugins/with-symbolsets.ts", { directory: "./assets/symbols" }],
		],
		experiments: {
			typedRoutes: true,
			reactCompiler: true,
		},
		ios: {
			bundleIdentifier: "com.tryoutlayr.app",
			appleTeamId: "8ZB3YXDU7V",
			deploymentTarget: IOS_DEPLOYMENT_TARGET,
			icon: isProduction
				? "./assets/Outlayr.icon"
				: "./assets/OutlayrTesting.icon",
			usesAppleSignIn: true,
			entitlements: {
				"com.apple.security.application-groups": [APP_GROUP],
			},
			infoPlist: {
				ITSAppUsesNonExemptEncryption: false,
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
