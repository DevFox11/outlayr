import { EN, ES } from "./catalog";
import { DEFAULT_LANGUAGE } from "./languages";
import { runtimeLanguage, setRuntimeLanguage, translateNow } from "./runtime";

afterEach(() => {
    setRuntimeLanguage(DEFAULT_LANGUAGE);
});

describe("translateNow", () => {
    it("starts on the default language", () => {
        expect(runtimeLanguage()).toBe(DEFAULT_LANGUAGE);
    });

    it("renders English before the provider has set anything", () => {
        expect(translateNow("common.cancel")).toBe(EN["common.cancel"]);
    });

    it("follows the language the provider set", () => {
        setRuntimeLanguage("es");
        expect(translateNow("common.cancel")).toBe(ES["common.cancel"]);
    });

    it("interpolates params", () => {
        setRuntimeLanguage("en");
        expect(translateNow("alerts.budget.deleteNamed", { name: "Rent" })).toBe("Delete the 'Rent' budget?");
    });
});
