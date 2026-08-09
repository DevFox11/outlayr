import { describe, expect, test } from "vitest";

import { isPhotoName, ownsPhotoKey, PHOTO_KEY_PREFIX, photoKeyFor, photoNameFromKey } from "./photoKeys";

const USER = "user-aaaa";
const OTHER = "user-bbbb";

describe("isPhotoName", () => {
	test("accepts the ids the device mints", () => {
		expect(isPhotoName("k7q2x9f1.jpg")).toBe(true);
		expect(isPhotoName("A-b_c.1.jpeg")).toBe(true);
	});

	test("rejects anything that could add or climb a path segment", () => {
		expect(isPhotoName("..")).toBe(false);
		expect(isPhotoName("../secret.jpg")).toBe(false);
		expect(isPhotoName("nested/photo.jpg")).toBe(false);
		expect(isPhotoName(".hidden.jpg")).toBe(false);
		expect(isPhotoName("")).toBe(false);
	});

	test("rejects a name long enough to be a payload", () => {
		expect(isPhotoName(`a${"b".repeat(127)}`)).toBe(true);
		expect(isPhotoName(`a${"b".repeat(128)}`)).toBe(false);
	});
});

describe("photoKeyFor", () => {
	test("namespaces the object under the account", () => {
		expect(photoKeyFor(USER, "a.jpg")).toBe(`${PHOTO_KEY_PREFIX}/${USER}/a.jpg`);
	});

	test("is derivable, so a retried upload reuses the same key", () => {
		expect(photoKeyFor(USER, "a.jpg")).toBe(photoKeyFor(USER, "a.jpg"));
	});
});

describe("ownsPhotoKey", () => {
	test("accepts a key this account minted", () => {
		expect(ownsPhotoKey(USER, photoKeyFor(USER, "a.jpg"))).toBe(true);
	});

	test("refuses another account's key", () => {
		expect(ownsPhotoKey(USER, photoKeyFor(OTHER, "a.jpg"))).toBe(false);
	});

	test("refuses a key that smuggles the owner into the name half", () => {
		expect(ownsPhotoKey(USER, `${PHOTO_KEY_PREFIX}/${OTHER}/../${USER}/a.jpg`)).toBe(false);
	});

	test("refuses a key outside the photo prefix", () => {
		expect(ownsPhotoKey(USER, `other-prefix/${USER}/a.jpg`)).toBe(false);
	});
});

describe("photoNameFromKey", () => {
	test("answers the device file name a key was minted from", () => {
		expect(photoNameFromKey(photoKeyFor(USER, "a.jpg"))).toBe("a.jpg");
	});

	test("answers null for a malformed key", () => {
		expect(photoNameFromKey("a.jpg")).toBeNull();
		expect(photoNameFromKey(`${PHOTO_KEY_PREFIX}/${USER}/a/b.jpg`)).toBeNull();
	});
});
