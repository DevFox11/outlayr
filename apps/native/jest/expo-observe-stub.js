// expo-image@57.0.2 calls ExpoObserve.getIntegrations() at import time; jest-expo's
// generic native-module mock lacks it, so resolve the optional module as absent.
jest.mock("expo", () => {
    const actual = jest.requireActual("expo");
    return new Proxy(actual, {
        get(target, prop) {
            if (prop === "requireOptionalNativeModule") {
                return (name) => (name === "ExpoObserve" ? null : target.requireOptionalNativeModule(name));
            }
            return target[prop];
        },
    });
});
