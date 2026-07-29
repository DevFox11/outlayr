import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { EN, ES } from "./catalog";
import { DEFAULT_LANGUAGE } from "./languages";
import { runtimeLanguage, setRuntimeLanguage, translateNow } from "./runtime";

afterEach(() => {
	setRuntimeLanguage(DEFAULT_LANGUAGE);
});

describe("translateNow", () => {
	it("starts on the default language", () => {
		assert.equal(runtimeLanguage(), DEFAULT_LANGUAGE);
	});

	it("renders English before the provider has set anything", () => {
		assert.equal(translateNow("common.cancel"), EN["common.cancel"]);
	});

	it("follows the language the provider set", () => {
		setRuntimeLanguage("es");
		assert.equal(translateNow("common.cancel"), ES["common.cancel"]);
	});

	it("interpolates params", () => {
		setRuntimeLanguage("en");
		assert.equal(
			translateNow("alerts.budget.deleteNamed", { name: "Rent" }),
			"Delete the 'Rent' budget?",
		);
	});
});
