/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = function intentsTarget(config) {
    return {
        displayName: "Outlayr",
        entitlements: {
            "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
        },
        frameworks: ["AppIntents", "SwiftUI"],
        name: "OutlayrIntents",
        type: "app-intent",
    };
};
