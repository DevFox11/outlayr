// jest-expo transforms to CJS, where `import.meta.dirname` reads as undefined;
// oxlint's unicorn/prefer-module writes it in place of `__dirname`.
module.exports = function importMetaDirnameToCjs({ types: t }) {
    return {
        name: "import-meta-dirname-to-cjs",
        visitor: {
            MemberExpression(path) {
                const { object, property } = path.node;

                if (
                    object.type !== "MetaProperty" ||
                    object.meta.name !== "import" ||
                    object.property.name !== "meta" ||
                    property.type !== "Identifier"
                ) {
                    return;
                }

                if (property.name === "dirname") {
                    path.replaceWith(t.identifier("__dirname"));
                } else if (property.name === "filename") {
                    path.replaceWith(t.identifier("__filename"));
                }
            },
        },
    };
};
