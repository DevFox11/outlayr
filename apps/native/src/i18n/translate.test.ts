import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { interpolate, translate } from "./translate";

const EN = {
	greeting: "Hello",
	welcome: "Welcome, {name}",
	pair: "{a} and {b}",
	entry_one: "{count} entry",
	entry_other: "{count} entries",
} as const;

const ES = {
	greeting: "Hola",
	welcome: "Bienvenido, {name}",
	pair: "{a} y {b}",
	entry_one: "{count} registro",
	entry_other: "{count} registros",
} as const;

describe("interpolate", () => {
	it("leaves a template without placeholders untouched", () => {
		assert.equal(interpolate("Hello", undefined), "Hello");
	});

	it("substitutes a named placeholder", () => {
		assert.equal(
			interpolate("Welcome, {name}", { name: "Ada" }),
			"Welcome, Ada",
		);
	});

	it("substitutes every occurrence of the same placeholder", () => {
		assert.equal(interpolate("{a}-{a}", { a: "x" }), "x-x");
	});

	it("stringifies numbers", () => {
		assert.equal(interpolate("{count} left", { count: 3 }), "3 left");
	});

	it("leaves an unmatched placeholder in place rather than printing undefined", () => {
		assert.equal(
			interpolate("Welcome, {name}", { other: "x" }),
			"Welcome, {name}",
		);
	});

	it("renders an explicit null as empty rather than leaking the token", () => {
		assert.equal(interpolate("Delete '{name}'?", { name: null }), "Delete ''?");
	});

	it("never prints the string 'null' or 'undefined'", () => {
		assert.doesNotMatch(
			interpolate("{a} {b}", { a: null, b: undefined }),
			/null|undefined/,
		);
	});
});

describe("translate", () => {
	it("returns the catalog value", () => {
		assert.equal(translate("greeting", { catalog: ES, fallback: EN }), "Hola");
	});

	it("interpolates params into the catalog value", () => {
		assert.equal(
			translate("welcome", {
				catalog: ES,
				fallback: EN,
				params: { name: "Ada" },
			}),
			"Bienvenido, Ada",
		);
	});

	it("falls back to English when the catalog lacks the key", () => {
		assert.equal(
			translate("greeting", { catalog: {}, fallback: EN }),
			"Hello",
			"a partial catalog must show working English, not a raw key",
		);
	});

	it("falls back to English for a plural key too", () => {
		assert.equal(
			translate("entry", { catalog: {}, fallback: EN, params: { count: 2 } }),
			"2 entries",
		);
	});

	it("picks the singular form when count is 1", () => {
		assert.equal(
			translate("entry", { catalog: ES, fallback: EN, params: { count: 1 } }),
			"1 registro",
		);
	});

	it("picks the plural form for zero", () => {
		assert.equal(
			translate("entry", { catalog: ES, fallback: EN, params: { count: 0 } }),
			"0 registros",
		);
	});

	it("picks the plural form for counts above one", () => {
		assert.equal(
			translate("entry", { catalog: ES, fallback: EN, params: { count: 5 } }),
			"5 registros",
		);
	});

	it("treats a negative count as plural", () => {
		assert.equal(
			translate("entry", { catalog: ES, fallback: EN, params: { count: -2 } }),
			"-2 registros",
		);
	});

	it("ignores count when the key has no plural forms", () => {
		assert.equal(
			translate("greeting", {
				catalog: ES,
				fallback: EN,
				params: { count: 3 },
			}),
			"Hola",
		);
	});

	it("returns the key when it is absent from both catalogs", () => {
		assert.equal(translate("nope", { catalog: {}, fallback: {} }), "nope");
	});
});
