const preset = require("jest-expo/jest-preset");
const reanimatedResolver = require("react-native-reanimated/jest/resolver");

const presetResolver = require(preset.resolver);

const PNPM_STORE_DIR = /node_modules[/\\]\.pnpm[/\\][^/\\]+[/\\]/;

module.exports = function resolve(request, options) {
    return reanimatedResolver(request, {
        ...options,
        basedir: options.basedir.replace(PNPM_STORE_DIR, ""),
        defaultResolver: (path, nextOptions) =>
            presetResolver(path, {
                ...nextOptions,
                basedir: options.basedir,
                defaultResolver: options.defaultResolver,
            }),
    });
};
