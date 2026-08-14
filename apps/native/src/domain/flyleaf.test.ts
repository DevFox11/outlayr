import { describe, expect, it } from "@jest/globals";

import { flyleafDate } from "./flyleaf";

describe("flyleafDate", () => {
    it("writes the English form", () => {
        expect(flyleafDate(new Date(2026, 6, 30), "en")).toBe("July 30, 2026");
    });

    it("writes the Spanish form", () => {
        expect(flyleafDate(new Date(2026, 6, 30), "es")).toBe("30 de julio de 2026");
    });

    it("covers the year boundary months", () => {
        expect(flyleafDate(new Date(2027, 0, 1), "en")).toBe("January 1, 2027");
        expect(flyleafDate(new Date(2026, 11, 31), "es")).toBe("31 de diciembre de 2026");
    });
});
