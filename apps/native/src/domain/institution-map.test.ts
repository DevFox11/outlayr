import { describe, expect, it } from "@jest/globals";

import { resolveInstitutionDomain } from "./institution-map";
import { merchantKey } from "./merchant-resolver";

describe("resolveInstitutionDomain", () => {
    it("folds punctuation and accents the way merchantKey does", () => {
        expect(resolveInstitutionDomain(merchantKey("U.S. Bank"))).toBe("usbank.com");
        expect(resolveInstitutionDomain(merchantKey("Itaú"))).toBe("itau.com.br");
        expect(resolveInstitutionDomain(merchantKey("100% Banco"))).toBe("100banco.com");
    });

    it("matches an institution named inside a longer account name", () => {
        expect(resolveInstitutionDomain(merchantKey("Chase Sapphire Reserve"))).toBe("chase.com");
        expect(resolveInstitutionDomain(merchantKey("Ahorros Banesco"))).toBe("banesco.com");
    });

    it("lets the more specific name win over the shorter one it contains", () => {
        expect(resolveInstitutionDomain(merchantKey("BBVA"))).toBe("bbva.com");
        expect(resolveInstitutionDomain(merchantKey("BBVA Provincial"))).toBe("provincial.com");
    });

    it("resolves installment companies, and the more specific name wins over the one it contains", () => {
        expect(resolveInstitutionDomain(merchantKey("Cashea"))).toBe("cashea.app");
        expect(resolveInstitutionDomain(merchantKey("Addi cupo"))).toBe("addi.com");
        expect(resolveInstitutionDomain(merchantKey("Mercado Crédito"))).toBe("mercadopago.com");
        expect(resolveInstitutionDomain(merchantKey("Cash App Afterpay"))).toBe("afterpay.com");
        expect(resolveInstitutionDomain(merchantKey("Cash App"))).toBe("cash.app");
    });

    // Common words that name a company only with a second token.
    it("does not brand a bare zip or alma", () => {
        expect(resolveInstitutionDomain(merchantKey("Zip"))).toBeNull();
        expect(resolveInstitutionDomain(merchantKey("Alma"))).toBeNull();
        expect(resolveInstitutionDomain(merchantKey("Zip Pay"))).toBe("zip.co");
    });

    // Plain cash is not a company. The model answers null for it, and so must this.
    it("answers nothing for a name no institution covers", () => {
        expect(resolveInstitutionDomain(merchantKey("Cash"))).toBeNull();
        expect(resolveInstitutionDomain(merchantKey("Vacation fund"))).toBeNull();
        expect(resolveInstitutionDomain("")).toBeNull();
    });

    // No fuzzy tier: branding an account with the wrong bank's logo is worse
    // than showing none.
    it("does not answer for a near-miss spelling", () => {
        expect(resolveInstitutionDomain(merchantKey("Chace"))).toBeNull();
    });
});
