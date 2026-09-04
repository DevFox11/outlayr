const preset = require("jest-expo/jest-preset");

/** @type {import("jest").Config} */
module.exports = {
    globalSetup: "<rootDir>/jest/timezone.js",
    moduleNameMapper: {
        // tsconfig maps `@/assets/*` outside `src/`, but jest-expo only picks up
        // the general `@/*` -> `src/*` rule, so every asset import resolves under
        // `src/assets` and 404s. Must precede that rule to win.
        "^@/assets/(.*)$": "<rootDir>/assets/$1",
        // See jest/worklets-stub.js for why: react-native-worklets@0.10.1's
        // NativeWorklets.native.ts crashes at import time under jest, before
        // react-native-reanimated's own IS_JEST handling ever runs.
        "^react-native-worklets$": "<rootDir>/jest/worklets-stub.js",
    },
    preset: "jest-expo",
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
        "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|uniwind|@legendapp/list|@hugeicons/react-native|drizzle-orm|intlayer|react-native-intlayer|dinero.js|number-flow-react-native|@t3-oss|convex|@convex-dev/better-auth|@better-auth|better-auth|@noble|jose|nanostores|panelui-native|lucide-react-native))",
    ],
};
