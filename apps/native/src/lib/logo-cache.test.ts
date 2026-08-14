import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("expo-file-system", () => {
    const existing = new Set<string>();
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
    }
    return { Directory, File, Paths: { cache: "/cache" }, __existing: existing };
});

import { cachedLogoUri, logoCacheKey } from "./logo-cache";

const { __existing } = jest.requireMock("expo-file-system") as {
    __existing: Set<string>;
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
