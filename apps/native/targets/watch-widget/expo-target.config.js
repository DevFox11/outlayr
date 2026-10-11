/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = function watchWidgetTarget(config) {
    return {
        bundleIdentifier: ".watchkitapp.widget",
        deploymentTarget: "11.0",
        displayName: "Outlayr",
        entitlements: {
            "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
        },
        name: "OutlayrComplication",
        type: "watch-widget",
    };
};
