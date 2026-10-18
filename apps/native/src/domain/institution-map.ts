import { buildPatternIndex, containsTokenSequence } from "./pattern-index";

/**
 * Banks, card issuers, brokerages and wallets — the things an ACCOUNT is named
 * after, which is a different question from the one `merchant-map.ts` answers.
 * A merchant is where money went; an institution is where money lives, and the
 * two lists barely overlap: nobody names an account "Netflix", and "Chase" as a
 * transaction payee is ambiguous (a fee? a transfer?) in a way it never is as an
 * account name.
 *
 * Identity only — no category, no tags. A bank has no useful spending category,
 * and inventing one here would leak into whatever consumes this next.
 *
 * Consulted solely by the account editor (`useAccountIdentity`). Keeping it out
 * of `resolveMerchant` is deliberate: adding these patterns there would make the
 * curated tier answer for a transaction named "Chase" and suppress the model
 * call that currently classifies it.
 */
interface InstitutionEntry {
    readonly domain: string;
    readonly id: string;
    /** The brand's own name, spelled and cased the way the brand spells it. */
    readonly label: string;
    /**
     * Already in `merchantKey` form — lowercase, unaccented, single-spaced.
     * A pattern matches when its token sequence appears anywhere in the name,
     * so "chase" covers "Chase Sapphire" without an entry for it.
     */
    readonly patterns: readonly string[];
}

const INSTITUTIONS: readonly InstitutionEntry[] = [
    // United States
    {
        domain: "chase.com",
        id: "chase",
        label: "Chase",
        patterns: ["chase", "chase bank", "jpmorgan chase", "jp morgan chase"],
    },
    {
        domain: "bankofamerica.com",
        id: "bank-of-america",
        label: "Bank of America",
        patterns: ["bank of america", "bofa"],
    },
    {
        domain: "wellsfargo.com",
        id: "wells-fargo",
        label: "Wells Fargo",
        patterns: ["wells fargo", "wellsfargo"],
    },
    { domain: "citi.com", id: "citi", label: "Citi", patterns: ["citi", "citibank"] },
    {
        domain: "capitalone.com",
        id: "capital-one",
        label: "Capital One",
        patterns: ["capital one", "capitalone"],
    },
    // `merchantKey` folds "U.S. Bank" to "u s bank".
    { domain: "usbank.com", id: "us-bank", label: "U.S. Bank", patterns: ["us bank", "u s bank", "usbank"] },
    { domain: "pnc.com", id: "pnc", label: "PNC", patterns: ["pnc", "pnc bank"] },
    { domain: "truist.com", id: "truist", label: "Truist", patterns: ["truist"] },
    { domain: "td.com", id: "td-bank", label: "TD Bank", patterns: ["td bank"] },
    {
        domain: "americanexpress.com",
        id: "american-express",
        label: "American Express",
        patterns: ["american express", "amex"],
    },
    { domain: "discover.com", id: "discover", label: "Discover", patterns: ["discover", "discover card"] },
    {
        domain: "schwab.com",
        id: "charles-schwab",
        label: "Charles Schwab",
        patterns: ["charles schwab", "schwab"],
    },
    { domain: "fidelity.com", id: "fidelity", label: "Fidelity", patterns: ["fidelity"] },
    { domain: "vanguard.com", id: "vanguard", label: "Vanguard", patterns: ["vanguard"] },
    { domain: "ally.com", id: "ally", label: "Ally", patterns: ["ally", "ally bank"] },
    { domain: "sofi.com", id: "sofi", label: "SoFi", patterns: ["sofi"] },
    { domain: "chime.com", id: "chime", label: "Chime", patterns: ["chime"] },
    {
        domain: "navyfederal.org",
        id: "navy-federal",
        label: "Navy Federal",
        patterns: ["navy federal", "navy federal credit union"],
    },
    { domain: "affirm.com", id: "affirm", label: "Affirm", patterns: ["affirm"] },
    {
        domain: "afterpay.com",
        id: "afterpay",
        label: "Afterpay",
        patterns: ["afterpay", "after pay", "cash app afterpay"],
    },
    { domain: "sezzle.com", id: "sezzle", label: "Sezzle", patterns: ["sezzle"] },
    { domain: "splitit.com", id: "splitit", label: "Splitit", patterns: ["splitit", "split it"] },

    // Wallets, transfer and brokerage
    { domain: "paypal.com", id: "paypal", label: "PayPal", patterns: ["paypal"] },
    { domain: "venmo.com", id: "venmo", label: "Venmo", patterns: ["venmo"] },
    // "cash app", never bare "cash" — plain cash is not a company, and the model
    // correctly answers null for it.
    { domain: "cash.app", id: "cash-app", label: "Cash App", patterns: ["cash app", "cashapp"] },
    { domain: "zellepay.com", id: "zelle", label: "Zelle", patterns: ["zelle"] },
    { domain: "wise.com", id: "wise", label: "Wise", patterns: ["wise", "transferwise"] },
    { domain: "revolut.com", id: "revolut", label: "Revolut", patterns: ["revolut"] },
    { domain: "payoneer.com", id: "payoneer", label: "Payoneer", patterns: ["payoneer"] },
    { domain: "stripe.com", id: "stripe", label: "Stripe", patterns: ["stripe"] },
    { domain: "coinbase.com", id: "coinbase", label: "Coinbase", patterns: ["coinbase"] },
    { domain: "binance.com", id: "binance", label: "Binance", patterns: ["binance"] },
    { domain: "robinhood.com", id: "robinhood", label: "Robinhood", patterns: ["robinhood"] },
    { domain: "airtm.com", id: "airtm", label: "Airtm", patterns: ["airtm"] },
    { domain: "zinli.com", id: "zinli", label: "Zinli", patterns: ["zinli"] },

    // Europe
    { domain: "n26.com", id: "n26", label: "N26", patterns: ["n26"] },
    { domain: "monzo.com", id: "monzo", label: "Monzo", patterns: ["monzo"] },
    {
        domain: "starlingbank.com",
        id: "starling",
        label: "Starling Bank",
        patterns: ["starling", "starling bank"],
    },
    { domain: "hsbc.com", id: "hsbc", label: "HSBC", patterns: ["hsbc"] },
    { domain: "barclays.co.uk", id: "barclays", label: "Barclays", patterns: ["barclays"] },
    { domain: "lloydsbank.com", id: "lloyds", label: "Lloyds", patterns: ["lloyds", "lloyds bank"] },
    { domain: "natwest.com", id: "natwest", label: "NatWest", patterns: ["natwest"] },
    { domain: "db.com", id: "deutsche-bank", label: "Deutsche Bank", patterns: ["deutsche bank"] },
    { domain: "ing.com", id: "ing", label: "ING", patterns: ["ing", "ing bank", "ing direct"] },
    { domain: "bbva.com", id: "bbva", label: "BBVA", patterns: ["bbva"] },
    {
        domain: "santander.com",
        id: "santander",
        label: "Santander",
        patterns: ["santander", "banco santander"],
    },
    { domain: "caixabank.com", id: "caixabank", label: "CaixaBank", patterns: ["caixabank", "la caixa"] },
    {
        domain: "bancsabadell.com",
        id: "sabadell",
        label: "Banco Sabadell",
        patterns: ["sabadell", "banco sabadell"],
    },
    { domain: "bankinter.com", id: "bankinter", label: "Bankinter", patterns: ["bankinter"] },
    { domain: "klarna.com", id: "klarna", label: "Klarna", patterns: ["klarna"] },
    { domain: "clearpay.co.uk", id: "clearpay", label: "Clearpay", patterns: ["clearpay", "clear pay"] },
    { domain: "scalapay.com", id: "scalapay", label: "Scalapay", patterns: ["scalapay"] },
    // "alma pay", never bare "alma" — it is a first name and a Spanish word.
    { domain: "almapay.com", id: "alma", label: "Alma", patterns: ["alma pay", "almapay"] },
    { domain: "oney.com", id: "oney", label: "Oney", patterns: ["oney"] },
    { domain: "zilch.com", id: "zilch", label: "Zilch", patterns: ["zilch"] },
    { domain: "riverty.com", id: "riverty", label: "Riverty", patterns: ["riverty"] },

    // Asia-Pacific and Middle East
    // "zip pay" and its old name, never bare "zip" — it is a common word.
    {
        domain: "zip.co",
        id: "zip",
        label: "Zip",
        patterns: ["zip pay", "zip co", "quadpay", "quad pay"],
    },
    // Atome has no global site; `atome.com` is another company.
    { domain: "atome.sg", id: "atome", label: "Atome", patterns: ["atome"] },
    { domain: "tabby.ai", id: "tabby", label: "Tabby", patterns: ["tabby"] },
    { domain: "tamara.co", id: "tamara", label: "Tamara", patterns: ["tamara"] },
    { domain: "paidy.com", id: "paidy", label: "Paidy", patterns: ["paidy"] },

    // Latin America
    { domain: "nubank.com.br", id: "nubank", label: "Nubank", patterns: ["nubank", "nu bank"] },
    {
        domain: "mercadopago.com",
        id: "mercado-pago",
        label: "Mercado Pago",
        patterns: ["mercado pago", "mercadopago", "mercado credito"],
    },
    { domain: "itau.com.br", id: "itau", label: "Itaú", patterns: ["itau", "itau unibanco"] },
    { domain: "bradesco.com.br", id: "bradesco", label: "Bradesco", patterns: ["bradesco"] },
    { domain: "bb.com.br", id: "banco-do-brasil", label: "Banco do Brasil", patterns: ["banco do brasil"] },
    {
        domain: "caixa.gov.br",
        id: "caixa-economica",
        label: "Caixa Econômica",
        patterns: ["caixa economica", "caixa economica federal"],
    },
    { domain: "bancointer.com.br", id: "banco-inter", label: "Banco Inter", patterns: ["banco inter"] },
    { domain: "c6bank.com.br", id: "c6-bank", label: "C6 Bank", patterns: ["c6 bank", "c6bank"] },
    { domain: "picpay.com", id: "picpay", label: "PicPay", patterns: ["picpay"] },
    { domain: "banorte.com", id: "banorte", label: "Banorte", patterns: ["banorte"] },
    { domain: "banamex.com", id: "banamex", label: "Banamex", patterns: ["banamex", "citibanamex"] },
    { domain: "bancolombia.com", id: "bancolombia", label: "Bancolombia", patterns: ["bancolombia"] },
    { domain: "davivienda.com", id: "davivienda", label: "Davivienda", patterns: ["davivienda"] },
    { domain: "nequi.com.co", id: "nequi", label: "Nequi", patterns: ["nequi"] },
    { domain: "daviplata.com", id: "daviplata", label: "Daviplata", patterns: ["daviplata"] },
    {
        domain: "bancogalicia.com.ar",
        id: "banco-galicia",
        label: "Banco Galicia",
        patterns: ["banco galicia", "galicia"],
    },
    { domain: "uala.com.ar", id: "uala", label: "Ualá", patterns: ["uala"] },
    { domain: "bancochile.cl", id: "banco-de-chile", label: "Banco de Chile", patterns: ["banco de chile"] },
    { domain: "viabcp.com", id: "bcp", label: "BCP", patterns: ["bcp", "banco de credito del peru"] },
    { domain: "interbank.pe", id: "interbank", label: "Interbank", patterns: ["interbank"] },
    { domain: "scotiabank.com", id: "scotiabank", label: "Scotiabank", patterns: ["scotiabank"] },
    { domain: "rbc.com", id: "rbc", label: "RBC", patterns: ["rbc", "royal bank of canada"] },
    {
        domain: "kueskipay.com",
        id: "kueski-pay",
        label: "Kueski Pay",
        patterns: ["kueski", "kueski pay", "kueskipay"],
    },
    { domain: "aplazo.mx", id: "aplazo", label: "Aplazo", patterns: ["aplazo"] },
    { domain: "coppel.com", id: "coppel", label: "Coppel", patterns: ["coppel", "credito coppel"] },
    { domain: "addi.com", id: "addi", label: "Addi", patterns: ["addi"] },
    {
        domain: "sistecredito.com",
        id: "sistecredito",
        label: "Sistecrédito",
        patterns: ["sistecredito", "siste credito"],
    },

    // Venezuela
    { domain: "banesco.com", id: "banesco", label: "Banesco", patterns: ["banesco"] },
    {
        domain: "mercantilbanco.com",
        id: "mercantil",
        label: "Banco Mercantil",
        patterns: ["mercantil", "banco mercantil"],
    },
    {
        domain: "bnc.com.ve",
        id: "bnc",
        label: "BNC",
        patterns: ["bnc", "banco nacional de credito"],
    },
    // Listed after "bbva" so the two-token pattern outranks it — see the sort in
    // `buildPatternIndex`, which does not depend on this file's order.
    {
        domain: "provincial.com",
        id: "provincial",
        label: "BBVA Provincial",
        patterns: ["bbva provincial", "provincial"],
    },
    {
        domain: "bdv.com.ve",
        id: "banco-de-venezuela",
        label: "Banco de Venezuela",
        patterns: ["banco de venezuela", "bdv"],
    },
    { domain: "bancamiga.com", id: "bancamiga", label: "Bancamiga", patterns: ["bancamiga"] },
    { domain: "banplus.com", id: "banplus", label: "Banplus", patterns: ["banplus"] },
    // `merchantKey` folds "100% Banco" to "100 banco".
    { domain: "100banco.com", id: "100-banco", label: "100% Banco", patterns: ["100 banco"] },
    { domain: "cashea.app", id: "cashea", label: "Cashea", patterns: ["cashea"] },
    { domain: "krece.app", id: "krece", label: "Krece", patterns: ["krece"] },
    { domain: "lysto.app", id: "lysto", label: "Lysto", patterns: ["lysto"] },
    { domain: "chollo.app", id: "chollo", label: "Chollo", patterns: ["chollo"] },
] as const;

const INSTITUTION_INDEX: ReadonlyMap<string, InstitutionEntry> = buildPatternIndex(INSTITUTIONS);

/**
 * The institution's domain, or null. Takes a key already folded by
 * `merchantKey`.
 *
 * Exact match then token-sequence match, and deliberately no fuzzy tier: the
 * merchant resolver can afford a near-miss because it only borrows the
 * category from one, but a near-miss here would brand an account with another
 * bank's logo, which is worse than showing none.
 */
export function resolveInstitutionDomain(key: string): string | null {
    if (key.length === 0) {
        return null;
    }
    const exact = INSTITUTION_INDEX.get(key);
    if (exact != null) {
        return exact.domain;
    }
    const tokens = key.split(" ");
    for (const [pattern, entry] of INSTITUTION_INDEX) {
        if (containsTokenSequence(tokens, pattern.split(" "))) {
            return entry.domain;
        }
    }
    return null;
}
