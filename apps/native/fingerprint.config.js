module.exports = {
    configPluginSourceType: "files",
    extraSources: [
        { filePath: "app-intents", reasons: ["appIntents"], type: "dir" },
        ...["tab-symbols", "toolbar-symbols", "menu-symbols"].map((dir) => ({
            filePath: `assets/${dir}`,
            reasons: ["nanoIconsSymbolSets"],
            type: "dir",
        })),
    ],
    // `extra.whatsNew` is set only at publish time (`UPDATE_MESSAGE`), so hashing it
    // gives every update a runtime no binary matches. The rest of `extra` still counts.
    fileHookTransform: (source, chunk) => {
        if (source.type !== "contents" || source.id !== "expoConfig") {
            return chunk;
        }
        const config = JSON.parse(chunk);
        delete config.extra?.whatsNew;
        return JSON.stringify(config);
    },
};
