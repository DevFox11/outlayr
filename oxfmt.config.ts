import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

// Same ignore list oxlint.config.ts carries; oxfmt reads `.gitignore` too, so
// only the tracked-but-unformatted paths need repeating here.
//
// `*.md` and `*.html` are formats oxfmt handles and Biome never did. The design
// artifacts under docs/design are visual references reviewed as rendered pages,
// and `proseWrap: "never"` would rejoin every wrapped paragraph in docs/ — both
// are churn, not migration. Drop these two entries to opt in.
const projectIgnores = [
    "**/*.html",
    "**/*.md",
    "**/.expo",
    "**/.nx",
    "**/dev-dist",
    "**/.zed",
    "**/.vscode",
    "**/src-tauri",
    "**/.alchemy",
    "**/.source",
    "**/drizzle",
    "**/uniwind-types.d.ts",
    "**/ios",
    "**/android",
    "**/Pods",
    "**/*.icon",
    "**/.agents",
    "**/.playwright-mcp",
    "**/.claude",
    "skills-lock.json",
    // Vendored upstream source; see the matching note in oxlint.config.ts.
    "tools/oxlint/anti-slop",
];

export default defineConfig({
    ...ultracite,
    ignorePatterns: [...ultracite.ignorePatterns, ...projectIgnores],
    printWidth: 120,
    tabWidth: 4,
});
