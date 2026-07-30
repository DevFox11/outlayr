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
		"search.results.out": t({
			en: "Out",
			es: "Salió",
		}),
		"search.results.net": t({
			en: "Net",
			es: "Neto",
		}),
	},
} satisfies Dictionary;

export default search;
