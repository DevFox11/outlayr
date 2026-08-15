import "dotenv/config";
import type { ConfigContext, ExpoConfig } from "expo/config";

const isProduction = process.env.EAS_BUILD_PROFILE === "production";

const APP_GROUP = "group.com.tryoutlayr.app";

const IOS_DEPLOYMENT_TARGET = "18.0";

const ALTERNATE_ICONS = ["OutlayrInk", "OutlayrHairline", "OutlayrMono", "OutlayrEmboss"];

const WIDGETS = [
    {
        description: "Today's spending, and one tap to add an entry.",
        displayName: "Log an Expense",
        ios: {
            supportedFamilies: ["systemSmall", "accessoryCircular", "accessoryRectangular", "accessoryInline"],
        },
        name: "Log",
    },
    {
        description: "What is left in your overall budget, and how far into the period you are.",
        displayName: "Budget",
        ios: {
            configuration: {
                parameters: {
                    budget: {
                        default: "auto",
                        title: "Budget",
                        type: "enum",
                        values: [
                            { name: "Automatic", value: "auto" },
                            { name: "Overall budget", value: "overall" },
                            { name: "Closest to its limit", value: "worst" },
                        ],
                    },
                },
                title: "Budget",
            },
            supportedFamilies: [
                "systemSmall",
                "systemMedium",
                "accessoryCircular",
                "accessoryRectangular",
                "accessoryInline",
            ],
        },
        name: "Budget",
    },
    {
        description: "Your most recent entries, newest first.",
        displayName: "Recent Entries",
        ios: {
            configuration: {
                parameters: {
                    measure: {
                        default: "spent",
                        title: "Figure",
                        type: "enum",
                        values: [
                            { name: "Spent", value: "spent" },
                            { name: "Income", value: "income" },
                            { name: "Net", value: "net" },
                        ],
                    },
                    period: {
                        default: "today",
                        title: "Period",
                        type: "enum",
                        values: [
                            { name: "Today", value: "today" },
                            { name: "This week", value: "week" },
                            { name: "This month", value: "month" },
                            { name: "This year", value: "year" },
                        ],
                    },
                },
                title: "Recent Entries",
            },
            supportedFamilies: ["systemMedium", "systemLarge", "accessoryRectangular", "accessoryInline"],
        },
        name: "Ledger",
    },
    {
        description: "Spend, income and net for the period, with where the money went.",
        displayName: "Insights",
        ios: {
            configuration: {
                parameters: {
                    period: {
                        default: "app",
                        title: "Period",
                        type: "enum",
                        values: [
                            { name: "Match the app", value: "app" },
                            { name: "This week", value: "week" },
                            { name: "This month", value: "month" },
                            { name: "This year", value: "year" },
                        ],
                    },
                },
                title: "Insights",
            },
            supportedFamilies: ["systemSmall", "systemMedium"],
        },
        name: "Insights",
    },
];

const roundedFontFiles = [
    "SF-Pro-Rounded-Regular.otf",
    "SF-Pro-Rounded-Medium.otf",
    "SF-Pro-Rounded-Semibold.otf",
    "SF-Pro-Rounded-Bold.otf",
];
// Listed unconditionally. These OTFs are committed, so a missing one is a
// broken checkout and should fail the build loudly. Guarding with existsSync
// silently dropped all four on EAS — `import.meta.dirname` points at the temp
// directory Expo transpiles this config into, not the project — and shipped a
// build in the system face instead of rounded.
const roundedFonts = roundedFontFiles.map((file) => `./assets/fonts/${file}`);

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

const getConfig = ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    android: {
        adaptiveIcon: {
            backgroundColor: "#f2f0ea",
            foregroundImage: "./assets/images/adaptive-icon.png",
        },
        package: "com.tryoutlayr.app",
    },
    experiments: {
        reactCompiler: true,
        typedRoutes: true,
    },
    extra: {
        appGroup: APP_GROUP,
        eas: {
            projectId: "f076a9e9-ec12-464d-85eb-772c4d0efce5",
        },
        primaryAppIcon: isProduction ? "Outlayr" : "OutlayrTesting",
    },
    ios: {
        appleTeamId: "8ZB3YXDU7V",
        bundleIdentifier: "com.tryoutlayr.app",
        deploymentTarget: IOS_DEPLOYMENT_TARGET,
        entitlements: {
            "com.apple.security.application-groups": [APP_GROUP],
        },
        icon: isProduction ? "./assets/Outlayr.icon" : "./assets/OutlayrTesting.icon",
        infoPlist: {
            CFBundleLocalizations: ["en", "es"],
            ITSAppUsesNonExemptEncryption: false,
        },
        usesAppleSignIn: true,
    },
    name: "Outlayr",
    orientation: "default",
    owner: "danestves-llc",
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
                        icon: "symbol:plus.circle.fill",
                        id: "log-expense",
                        params: { href: "outlayr://new" },
                        title: "Log Expense",
                    },
                    {
                        icon: "symbol:arrow.down.circle.fill",
                        id: "log-income",
                        params: { href: "outlayr://new?income=1" },
                        title: "Log Income",
                    },
                    {
                        icon: "symbol:magnifyingglass",
                        id: "search",
                        params: { href: "outlayr://search" },
                        title: "Search Entries",
                    },
                    {
                        icon: "symbol:chart.pie.fill",
                        id: "budgets",
                        params: { href: "outlayr://budgets" },
                        title: "Budgets",
                    },
                ],
            },
        ],
        [
            "expo-splash-screen",
            {
                // `--background` in each theme. The splash hands off to the first
                // screen without a crossfade, so a value that is merely close shows up
                // as a flash at the handoff rather than as a slightly wrong grey.
                backgroundColor: "#f2f0ea",
                dark: {
                    backgroundColor: "#17150f",
                    image: "./assets/images/splash-icon-dark.png",
                },
                image: "./assets/images/splash-icon.png",
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
                iosUrlScheme: googleIosUrlScheme(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS),
            },
        ],
        [
            "expo-image-picker",
            {
                cameraPermission: false,
                photosPermission: "Outlayr uses your photos to set a custom logo for a transaction.",
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
    scheme: "outlayr",
    slug: "outlayr",
    userInterfaceStyle: "automatic",
    // The marketing version users see. The build number beside it is not here:
    // `eas.json` sets `appVersionSource: "remote"`, so EAS owns and increments
    // it, and a local `ios.buildNumber` would be ignored.
    version: "1.0.0",
});

export default getConfig;
