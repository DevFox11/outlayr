import { type ConfigPlugin, withPodfile } from "expo/config-plugins";

const MARKER = "# @generated with-min-pod-deployment-target";
const POST_INSTALL_ANCHOR = "post_install do |installer|";

// CocoaPods resource-bundle targets (e.g. RNSVG-RNSVGFilters) keep the
// deployment target declared in their podspec (iOS 12.4 for react-native-svg),
// because React Native's updateOSDeploymentTarget only floors each pod's main
// native_target. Current Xcode rejects targets below iOS 15.0, so floor every
// pod target — resource bundles included — to the project minimum. The minimum
// is read from Podfile.properties.json, which expo-build-properties populates
// via its ios.deploymentTarget option.
const POST_INSTALL_PATCH = `${POST_INSTALL_ANCHOR}
    ${MARKER}
    min_ios = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '16.4')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        next unless current.to_s.match?(/\\A\\d+(\\.\\d+)*\\z/)
        if Gem::Version.new(current) < min_ios
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios.to_s
        end
      end
    end`;

const withMinPodDeploymentTarget: ConfigPlugin = (config) =>
	withPodfile(config, (podfileConfig) => {
		const { contents } = podfileConfig.modResults;
		if (contents.includes(MARKER)) {
			return podfileConfig;
		}
		if (!contents.includes(POST_INSTALL_ANCHOR)) {
			throw new Error(
				`withMinPodDeploymentTarget: could not find "${POST_INSTALL_ANCHOR}" in the generated Podfile. The Expo template may have changed; update this plugin.`
			);
		}
		podfileConfig.modResults.contents = contents.replace(POST_INSTALL_ANCHOR, POST_INSTALL_PATCH);
		return podfileConfig;
	});

export default withMinPodDeploymentTarget;
