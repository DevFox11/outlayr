import { type Dictionary, t } from "intlayer";

const search = {
	key: "search" as const,
	content: {
		"search.placeholder": t({
			en: "Search entry by note",
			es: "Buscar registro por nota",
		}),
		"search.empty.idle.title": t({
			en: "Search your ledger",
			es: "Busca en tu registro",
		}),
		"search.empty.idle.body": t({
			en: "Find an entry by its note, category, or amount.",
			es: "Encuentra un registro por su nota, categoría o monto.",
		}),
		"search.empty.noResults.title": t({
			en: "No matches",
			es: "Sin coincidencias",
		}),
		"search.empty.noResults.body": t({
			en: "No entry matches “{query}”.",
			es: "Ningún registro coincide con “{query}”.",
		}),
	},
} satisfies Dictionary;

export default search;
