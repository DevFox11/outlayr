/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = function watchTarget(config) {
    return {
        bundleIdentifier: ".watchkitapp",
        deploymentTarget: "11.0",
        displayName: "Outlayr",
        entitlements: {
            "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
        },
        frameworks: ["SwiftUI", "WatchConnectivity"],
        icon:
            process.env.EAS_BUILD_PROFILE === "production"
                ? "../../assets/images/icon.png"
                : "../../assets/images/icon-testing.png",
        name: "OutlayrWatch",
        type: "watch",
    };
};
