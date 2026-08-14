import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const search = {
    content: {
        "search.empty.idle.body": t({
            en: "Find an entry by its note, category, or amount.",
            es: "Encuentra un registro por su nota, categoría o monto.",
        }),
        "search.empty.idle.title": t({
            en: "Search your ledger",
            es: "Busca en tu registro",
        }),
        "search.empty.noResults.body": t({
            en: "No entry matches “{query}”.",
            es: "Ningún registro coincide con “{query}”.",
        }),
        "search.empty.noResults.title": t({
            en: "No matches",
            es: "Sin coincidencias",
        }),
        "search.placeholder": t({
            en: "Search entry by note",
            es: "Buscar registro por nota",
        }),
        "search.results.count_one": t({
            en: "{count} result",
            es: "{count} resultado",
        }),
        "search.results.count_other": t({
            en: "{count} results",
            es: "{count} resultados",
        }),
        "search.results.in": t({
            en: "In",
            es: "Entró",
        }),
        "search.results.net": t({
            en: "Net",
            es: "Neto",
        }),
        "search.results.out": t({
            en: "Out",
            es: "Salió",
        }),
    },
    key: "search" as const,
} satisfies Dictionary;

export default search;
