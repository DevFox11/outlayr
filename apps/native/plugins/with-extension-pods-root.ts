import { withPodfile } from "expo/config-plugins";
import type { ConfigPlugin } from "expo/config-plugins";

const MARKER = "# @generated with-extension-pods-root";
const POST_INSTALL_ANCHOR = "post_install do |installer|";

// react_native_post_install writes CC/LD/CXX/LDPLUSPLUS at the *project* level as
// $(REACT_NATIVE_PATH)/scripts/xcode/ccache-clang.sh, and REACT_NATIVE_PATH itself as
// ${PODS_ROOT}/<traversal to node_modules>. PODS_ROOT only exists on targets CocoaPods
// generates an xcconfig for, so on a target with no pods of its own — OutlayrIntents, which
// the Podfile never declares — it expands to nothing and the compiler path collapses to
// /../../../../node_modules/..., which Xcode cannot spawn. Declaring the same fallback
// CocoaPods writes into the app's xcconfig keeps every pod-less target resolving the real
// path. Only bites when ccache is on, i.e. on EAS Build, which sets USE_CCACHE=1.
const POST_INSTALL_PATCH = `${POST_INSTALL_ANCHOR}
    ${MARKER}
    installer.aggregate_targets.map(&:user_project).uniq { |project| project.path }.each do |project|
      project.build_configurations.each do |build_config|
        build_config.build_settings['PODS_ROOT'] ||= '$(SRCROOT)/Pods'
      end
      project.save()
    end`;

const withExtensionPodsRoot: ConfigPlugin = (config) =>
    withPodfile(config, (podfileConfig) => {
        const { contents } = podfileConfig.modResults;
        if (contents.includes(MARKER)) {
            return podfileConfig;
        }
        if (!contents.includes(POST_INSTALL_ANCHOR)) {
            throw new Error(
                `withExtensionPodsRoot: could not find "${POST_INSTALL_ANCHOR}" in the generated Podfile. The Expo template may have changed; update this plugin.`
            );
        }
        podfileConfig.modResults.contents = contents.replace(POST_INSTALL_ANCHOR, POST_INSTALL_PATCH);
        return podfileConfig;
    });

export default withExtensionPodsRoot;
