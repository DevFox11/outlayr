import { cp } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import {
	type ConfigPlugin,
	IOSConfig,
	withDangerousMod,
	withXcodeProject,
} from "expo/config-plugins";

const ALTERNATE_NAMES = "ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES";
const INCLUDE_ALL = "ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS";

/**
 * Registers extra `.icon` bundles as alternates for `setAlternateIconName`.
 * Expo's own `withIosIcons` handles exactly one — `ios.icon` — so everything
 * here mirrors what it does for the primary, one bundle at a time.
 *
 * `INCLUDE_ALL` is what makes `actool` emit `CFBundleAlternateIcons` into the
 * built Info.plist. Nothing writes those keys in source, so a missing alternate
 * shows up only as `setAlternateIconName` rejecting the name at runtime.
 */
const withAlternateIcons: ConfigPlugin<{ icons: string[] }> = (
	config,
	{ icons },
) => {
	const names = icons.map((icon) => basename(icon, ".icon"));

	for (const icon of icons) {
		if (extname(icon) !== ".icon") {
			throw new Error(
				`withAlternateIcons: "${icon}" is not a .icon bundle. Alternates have to be the same Icon Composer format as ios.icon.`,
			);
		}
	}

	const withCopiedBundles = withDangerousMod(config, [
		"ios",
		async (dangerousConfig) => {
			const { platformProjectRoot, projectName, projectRoot } =
				dangerousConfig.modRequest;
			if (!projectName) {
				throw new Error("withAlternateIcons: no iOS project name.");
			}
			for (const icon of icons) {
				await cp(
					join(projectRoot, icon),
					join(platformProjectRoot, projectName, `${basename(icon)}`),
					{ recursive: true },
				);
			}
			return dangerousConfig;
		},
	]);

	return withXcodeProject(withCopiedBundles, (xcodeConfig) => {
		const { projectName } = xcodeConfig.modRequest;
		if (!projectName) {
			throw new Error("withAlternateIcons: no iOS project name.");
		}
		for (const name of names) {
			IOSConfig.XcodeUtils.addResourceFileToGroup({
				filepath: `${projectName}/${name}.icon`,
				groupName: projectName,
				isBuildFile: true,
				project: xcodeConfig.modResults,
			});
		}
		if (!xcodeConfig.modResults.pbxTargetByName(projectName)) {
			throw new Error(
				`withAlternateIcons: no native target named "${projectName}". Expo prebuild names the app target after the project; update this plugin if that changed.`,
			);
		}
		// Target-scoped on purpose. Left project-wide it would also land on the
		// widget and intents extensions, whose asset catalogues hold none of these
		// names, and actool fails the build rather than ignoring them.
		xcodeConfig.modResults.updateBuildProperty(
			ALTERNATE_NAMES,
			`"${names.join(" ")}"`,
			undefined,
			projectName,
		);
		xcodeConfig.modResults.updateBuildProperty(
			INCLUDE_ALL,
			"YES",
			undefined,
			projectName,
		);
		return xcodeConfig;
	});
};

export default withAlternateIcons;
