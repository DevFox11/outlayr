import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";

const DRIZZLE_DIR = join(import.meta.dirname, "..", "..", "drizzle");

function journalTags(): string[] {
    const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf-8")) as {
        entries: { tag: string }[];
    };
    return journal.entries.map((entry) => entry.tag);
}

function bundleSource(): string {
    return readFileSync(join(DRIZZLE_DIR, "migrations.js"), "utf-8");
}

function sqlFileTags(): string[] {
    return readdirSync(DRIZZLE_DIR)
        .filter((name) => name.endsWith(".sql"))
        .map((name) => name.replace(/\.sql$/, ""))
        .sort();
}

describe("drizzle/migrations.js is a tracked file, not a generated one", () => {
    it("imports every migration the journal lists", () => {
        const source = bundleSource();
        const missing = journalTags().filter((tag) => !source.includes(`'./${tag}.sql'`));
        expect(missing).toStrictEqual([]);
    });

    it("exports every migration the journal lists", () => {
        const source = bundleSource();
        const exported = source.slice(source.indexOf("migrations: {"));
        const missing = journalTags()
            .map((_tag, index) => `m${String(index).padStart(4, "0")}`)
            .filter((key) => !new RegExp(`\\b${key}\\b`).test(exported));
        expect(missing).toStrictEqual([]);
    });

    it("has a journal entry for every migration file on disk", () => {
        expect(sqlFileTags()).toStrictEqual([...journalTags()].sort());
    });

    it("keeps the journal in index order with no gaps", () => {
        const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf-8")) as {
            entries: { idx: number }[];
        };
        expect(journal.entries.map((entry) => entry.idx)).toStrictEqual(journal.entries.map((_entry, index) => index));
    });
});
