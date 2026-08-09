"use strict";

const path = require("node:path");

const { getDefaultConfig } = require("expo/metro-config");
const { configMetroIntlayerSync } = require("react-native-intlayer/metro");
const { withUniwindConfig } = require("uniwind/metro");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

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
const finalConfig = configMetroIntlayerSync(
	withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
		cssEntryFile: "./global.css",
		dtsFile: "./uniwind-types.d.ts",
	})
);

const SIM_PREVIEW_PATH = "/.sim";

/**
 * Expo's dev server dispatches WebSocket upgrades by exact pathname against its
 * own endpoint map and calls `socket.destroy()` on every miss, which kills the
 * preview's input and DevTools sockets — the stream is HTTP, so video survives
 * and only touch silently stops working. See `@expo/cli`
 * `src/start/server/metro/runServer-fork.ts`. Re-entering the listener list is
 * the only hook: ours claims the `/.sim` prefix and replays every other upgrade
 * through the original listeners untouched, so `/hot` and the CDP inspector are
 * unaffected. If a future SDK registers its handler after the first request,
 * this stops claiming upgrades and input degrades — it never breaks Metro.
 */
function claimSimUpgrades(server, sim) {
	const inherited = server.listeners("upgrade");
	server.removeAllListeners("upgrade");

	server.on("upgrade", (req, socket, head) => {
		if (req.url?.startsWith(SIM_PREVIEW_PATH)) {
			sim.handleUpgrade(req, socket, head);
			return;
		}
		if (inherited.length === 0) {
			socket.destroy();
			return;
		}
		for (const listener of inherited) {
			listener.call(server, req, socket, head);
		}
	});
}

// Serve the simulator preview from the Metro server so QA has one URL to target.
// Assigned after the wrappers because each returns a fresh config object.
finalConfig.server = {
	...finalConfig.server,
	enhanceMiddleware: (metroMiddleware) => {
		const { simMiddleware } = require("serve-sim/middleware");
		const sim = simMiddleware({ basePath: SIM_PREVIEW_PATH });
		let claimed = false;

		return (req, res, next) => {
			if (!claimed && req.socket?.server) {
				claimed = true;
				claimSimUpgrades(req.socket.server, sim);
			}
			if (req.url?.startsWith(SIM_PREVIEW_PATH)) {
				return sim(req, res, () => metroMiddleware(req, res, next));
			}
			return metroMiddleware(req, res, next);
		};
	},
};

module.exports = finalConfig;
