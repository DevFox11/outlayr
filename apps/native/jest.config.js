const path = require("node:path");

const preset = require("jest-expo/jest-preset");

// jest-expo mocks whichever expo-modules-core pnpm hoists, and with two copies in the graph that
// can be one the app never loads. Pin both to the copy the app's `expo` resolves.
const expoModulesCore = path.dirname(
    require.resolve("expo-modules-core/package.json", { paths: [path.dirname(require.resolve("expo/package.json"))] })
);

/** @type {import("jest").Config} */
module.exports = {
    globalSetup: "<rootDir>/jest/global-setup.js",
    moduleNameMapper: {
        // tsconfig maps `@/assets/*` outside `src/`, but jest-expo only picks up
        // the general `@/*` -> `src/*` rule, so every asset import resolves under
        // `src/assets` and 404s. Must precede that rule to win.
        "^@/assets/(.*)$": "<rootDir>/assets/$1",
        "^react-native-worklets$": "react-native-worklets/src/mock",
        "^expo-modules-core$": expoModulesCore,
        "^expo-modules-core/(.*)$": `${expoModulesCore}/$1`,
    },
    preset: "jest-expo",
    resolver: "<rootDir>/jest/resolver.js",
    setupFiles: [
        "react-native-gesture-handler/jestSetup.js",
        "<rootDir>/jest/expo-observe-stub.js",
        "<rootDir>/jest/env-stub.js",
        "<rootDir>/jest/sqlite-change-listener-stub.js",
        "<rootDir>/jest/i18n-key-stub.js",
    ],
    testMatch: ["**/*.test.ts?(x)"],
    // panelui-native's kpi pulls in lucide-react-native, which ships ESM under
    // .mjs — an extension jest-expo's `\.[jt]sx?$` transform never matches, so
    // without this it reaches the runtime untranspiled.
    transform: {
        ...preset.transform,
        "\\.mjs$": preset.transform["\\.[jt]sx?$"],
    },
    transformIgnorePatterns: [
        "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|uniwind|@legendapp/list|@hugeicons/react-native|drizzle-orm|intlayer|react-native-intlayer|dinero.js|number-flow-react-native|@t3-oss|convex|@convex-dev/better-auth|@better-auth|better-auth|@noble|jose|nanostores|panelui-native|lucide-react-native|@revenuecat|react-native-purchases))",
    ],
};
