/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
	type: "app-intent",
	name: "OutlayrIntents",
	displayName: "Outlayr",
	deploymentTarget: "18.0",
	frameworks: ["AppIntents", "SwiftUI"],
	entitlements: {
		"com.apple.security.application-groups":
			config.ios.entitlements["com.apple.security.application-groups"],
	},
});
