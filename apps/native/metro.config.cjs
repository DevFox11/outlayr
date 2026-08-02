"use strict";

const path = require("node:path");

const { getDefaultConfig } = require("expo/metro-config");
const { configMetroIntlayerSync } = require("react-native-intlayer/metro");
const { withUniwindConfig } = require("uniwind/metro");
const {
	wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The hoisted pnpm store must stay watched: `@shopify/react-native-skia` resolves
// to `src/index.ts`, which re-exports a *directory* (`./views`), and directory-index
// resolution only searches files Metro has crawled. SDK 57's default already
// includes it, so this asserts the invariant rather than re-adding it.
const pnpmStore = path.resolve(__dirname, "../../node_modules");
if (!config.watchFolders.includes(pnpmStore)) {
	config.watchFolders.push(pnpmStore);
}

// Let Metro resolve the `.sql` files that drizzle's generated migrations
// bundle imports. Must run before the reanimated/uniwind wrappers, which
// extend (never reset) the resolver — re-verify on upgrades.
config.resolver.sourceExts.push("sql");

// Intlayer goes outermost: it spreads the resolver it is handed and chains its
// `resolveRequest` to the existing one, so it inherits the `.sql` extension and
// both wrappers rather than replacing them. The sync variant does not build
// dictionaries on server start — `pnpm i18n:build` owns that, so a clean clone
// and CI produce them the same way rather than only whoever ran Metro.
module.exports = configMetroIntlayerSync(
	withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
		cssEntryFile: "./global.css",
		dtsFile: "./uniwind-types.d.ts",
	}),
);
