"use strict";

const path = require("node:path");

const { getDefaultConfig } = require("expo/metro-config");
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

// apps/ios is the Swift app — a workspace member with no JS, so Metro's default
// crawl walks ~1.3 GB of Xcode output for nothing.
const swiftApp = path.resolve(__dirname, "../ios");
config.watchFolders = config.watchFolders.filter((dir) => dir !== swiftApp);

// Let Metro resolve the `.sql` files that drizzle's generated migrations
// bundle imports. Must run before the reanimated/uniwind wrappers, which
// extend (never reset) the resolver — re-verify on upgrades.
config.resolver.sourceExts.push("sql");

module.exports = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
	cssEntryFile: "./global.css",
	dtsFile: "./uniwind-types.d.ts",
});
