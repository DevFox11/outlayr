module.exports = function babelConfig(api) {
    api.cache(true);
    return {
        env: {
            test: {
                plugins: ["./jest/import-meta-plugin.js"],
            },
        },
        plugins: [["inline-import", { extensions: [".sql"] }]],
        presets: ["babel-preset-expo"],
    };
};
