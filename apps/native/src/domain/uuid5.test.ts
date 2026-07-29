import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { uuidV5 } from "./uuid5";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

describe("uuidV5", () => {
	it("matches the RFC 4122 published vectors", () => {
		assert.equal(
			uuidV5("python.org", DNS_NAMESPACE),
			"886313e1-3b8a-5372-9b90-0c9aee199e5d",
		);
		assert.equal(
			uuidV5("http://python.org/", URL_NAMESPACE),
			"4c565f0d-3f5a-5890-b41b-20cf47701c5e",
		);
	});

	it("stamps version 5 and the RFC variant", () => {
		const id = uuidV5("anything", DNS_NAMESPACE);

		assert.match(
			id,
			/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});

	it("is stable across calls and distinct across names", () => {
		assert.equal(uuidV5("a", DNS_NAMESPACE), uuidV5("a", DNS_NAMESPACE));
		assert.notEqual(uuidV5("a", DNS_NAMESPACE), uuidV5("b", DNS_NAMESPACE));
		assert.notEqual(uuidV5("a", DNS_NAMESPACE), uuidV5("a", URL_NAMESPACE));
	});

	// The padding arithmetic is the part most likely to be subtly wrong, and it
	// only misbehaves on inputs that straddle a 64-byte block boundary.
	it("digests inputs of every length around a block boundary", () => {
		for (let length = 0; length < 200; length += 1) {
			const name = "x".repeat(length);
			const expected = createHash("sha1")
				.update(Buffer.from(DNS_NAMESPACE.replace(/-/g, ""), "hex"))
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

			assert.equal(uuidV5(name, DNS_NAMESPACE), formatted, `length ${length}`);
		}
	});

	it("handles multi-byte names", () => {
		const expected = createHash("sha1")
			.update(Buffer.from(DNS_NAMESPACE.replace(/-/g, ""), "hex"))
			.update("café — 日本", "utf8")
			.digest();
		expected[6] = (expected[6] & 0x0f) | 0x50;
		expected[8] = (expected[8] & 0x3f) | 0x80;
		const hex = expected.subarray(0, 16).toString("hex");

		assert.equal(uuidV5("café — 日本", DNS_NAMESPACE).replace(/-/g, ""), hex);
	});

	it("rejects a namespace that is not a UUID", () => {
		assert.throws(() => uuidV5("name", "not-a-uuid"));
	});

	it("accepts a freshly minted namespace", () => {
		const namespace = randomUUID();

		assert.equal(uuidV5("name", namespace), uuidV5("name", namespace));
	});
});
