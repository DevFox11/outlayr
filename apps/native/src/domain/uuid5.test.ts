import { createHash, randomUUID } from "node:crypto";

import { uuidV5 } from "./uuid5";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

describe("uuidV5", () => {
    it("matches the RFC 4122 published vectors", () => {
        expect(uuidV5("python.org", DNS_NAMESPACE)).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
        expect(uuidV5("http://python.org/", URL_NAMESPACE)).toBe("4c565f0d-3f5a-5890-b41b-20cf47701c5e");
    });

    it("stamps version 5 and the RFC variant", () => {
        const id = uuidV5("anything", DNS_NAMESPACE);

        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("is stable across calls and distinct across names", () => {
        expect(uuidV5("a", DNS_NAMESPACE)).toBe(uuidV5("a", DNS_NAMESPACE));
        expect(uuidV5("a", DNS_NAMESPACE)).not.toBe(uuidV5("b", DNS_NAMESPACE));
        expect(uuidV5("a", DNS_NAMESPACE)).not.toBe(uuidV5("a", URL_NAMESPACE));
    });

    // The padding arithmetic is the part most likely to be subtly wrong, and it
    // only misbehaves on inputs that straddle a 64-byte block boundary.
    it("digests inputs of every length around a block boundary", () => {
        for (let length = 0; length < 200; length += 1) {
            const name = "x".repeat(length);
            const expected = createHash("sha1")
                .update(Buffer.from(DNS_NAMESPACE.replaceAll("-", ""), "hex"))
                .update(name)
                .digest();
            expected[6] = (expected[6] & 0x0f) | 0x50;
            expected[8] = (expected[8] & 0x3f) | 0x80;
            const hex = expected.subarray(0, 16).toString("hex");
            const formatted = [
                hex.slice(0, 8),
                hex.slice(8, 12),
                hex.slice(12, 16),
                hex.slice(16, 20),
                hex.slice(20, 32),
            ].join("-");

            expect(uuidV5(name, DNS_NAMESPACE)).toBe(formatted);
        }
    });

    it("handles multi-byte names", () => {
        const expected = createHash("sha1")
            .update(Buffer.from(DNS_NAMESPACE.replaceAll("-", ""), "hex"))
            .update("café — 日本", "utf-8")
            .digest();
        expected[6] = (expected[6] & 0x0f) | 0x50;
        expected[8] = (expected[8] & 0x3f) | 0x80;
        const hex = expected.subarray(0, 16).toString("hex");

        expect(uuidV5("café — 日本", DNS_NAMESPACE).replaceAll("-", "")).toBe(hex);
    });

    it("rejects a namespace that is not a UUID", () => {
        expect(() => uuidV5("name", "not-a-uuid")).toThrow();
    });

    it("accepts a freshly minted namespace", () => {
        const namespace = randomUUID();

        expect(uuidV5("name", namespace)).toBe(uuidV5("name", namespace));
    });
});
