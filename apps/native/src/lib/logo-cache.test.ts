import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("expo-file-system", () => {
    const existing = new Set<string>();
    const writtenAt = new Map<string, number>();
    class Directory {
        get exists() {
            return true;
        }
        create() {}
    }
    class File {
        private readonly name: string;
        constructor(_parent: unknown, name: string) {
            this.name = name;
        }
        get exists() {
            return existing.has(this.name);
        }
        get uri() {
            return `file:///cache/merchant-logos/${this.name}`;
        }
        get modificationTime() {
            return writtenAt.get(this.name);
        }
        delete() {
            existing.delete(this.name);
        }
    }
    return { Directory, File, Paths: { cache: "/cache" }, __existing: existing, __writtenAt: writtenAt };
});

import { cachedLogoUri, logoCacheKey, readCachedLogo } from "./logo-cache";

const { __existing, __writtenAt } = jest.requireMock("expo-file-system") as {
    __existing: Set<string>;
    __writtenAt: Map<string, number>;
};

describe("logoCacheKey", () => {
    it("is stable for the same name and domain", () => {
        expect(logoCacheKey("Netflix", "netflix.com")).toBe(logoCacheKey("Netflix", "netflix.com"));
    });

    it("folds case, diacritics and punctuation to the same key", () => {
        expect(logoCacheKey("NETFLIX", "netflix.com")).toBe(logoCacheKey("netflix", "netflix.com"));
    });

    it("differs for a different domain", () => {
        expect(logoCacheKey("Rio", "riosupermercado.com")).not.toBe(logoCacheKey("Rio", "rio.com"));
    });
});

describe("cachedLogoUri", () => {
    beforeEach(() => {
        __existing.clear();
    });

    it("returns null for an empty key", () => {
        expect(cachedLogoUri("")).toBeNull();
    });

    it("returns null for a merchant the cache has never seen", () => {
        expect(cachedLogoUri("netflix")).toBeNull();
    });

    it("returns the cached file's uri for a hit", () => {
        __existing.add("netflix");
        expect(cachedLogoUri("netflix")).toBe("file:///cache/merchant-logos/netflix");
    });

    it("returns null for a remembered miss, even though the marker file exists", () => {
        __existing.add("netflix.miss");
        expect(cachedLogoUri("netflix")).toBeNull();
    });
});

describe("a miss expires", () => {
    const WEEK = 7 * 24 * 60 * 60 * 1000;

    beforeEach(() => {
        __existing.clear();
        __writtenAt.clear();
    });

    it("is still a miss inside the week", async () => {
        __existing.add("zinli.miss");
        __writtenAt.set("zinli.miss", 1000);
        await expect(readCachedLogo("zinli", 1000 + WEEK - 1)).resolves.toStrictEqual({ kind: "miss" });
        expect(cachedLogoUri("zinli", 1000 + WEEK - 1)).toBeNull();
    });

    it("is forgotten, and its marker removed, once the week is up", async () => {
        __existing.add("zinli.miss");
        __writtenAt.set("zinli.miss", 1000);
        await expect(readCachedLogo("zinli", 1000 + WEEK + 1)).resolves.toStrictEqual({ kind: "unknown" });
        expect(__existing.has("zinli.miss")).toBe(false);
    });

    it("keeps a marker with no readable time, rather than guessing", async () => {
        __existing.add("zinli.miss");
        await expect(readCachedLogo("zinli", Number.MAX_SAFE_INTEGER)).resolves.toStrictEqual({ kind: "miss" });
    });
});
