/** @type {import("jest").Config} */
module.exports = {
	preset: "jest-expo",
	testMatch: ["**/*.test.ts?(x)"],
	moduleNameMapper: {
		// See jest/worklets-stub.js for why: react-native-worklets@0.10.1's
		// NativeWorklets.native.ts crashes at import time under jest, before
		// react-native-reanimated's own IS_JEST handling ever runs.
		"^react-native-worklets$": "<rootDir>/jest/worklets-stub.js",
	},
	transformIgnorePatterns: [
		"/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|uniwind|@legendapp/list|@hugeicons/react-native|drizzle-orm|intlayer|react-native-intlayer|dinero.js|number-flow-react-native))",
	],
};
