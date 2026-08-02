/** @type {import("jest").Config} */
module.exports = {
	preset: "jest-expo",
	testMatch: ["**/*.test.tsx"],
	transformIgnorePatterns: [
		"/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|uniwind|@legendapp/list|@hugeicons/react-native|drizzle-orm|intlayer|react-native-intlayer))",
	],
};
