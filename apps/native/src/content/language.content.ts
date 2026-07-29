import { type Dictionary, t } from "intlayer";

const language = {
	key: "language" as const,
	content: {
		"language.title": t({
			en: "Language",
			es: "Idioma",
		}),
		"language.section": t({
			en: "Display Language",
			es: "Idioma de la app",
		}),
		"language.system": t({
			en: "System",
			es: "Sistema",
		}),
		"language.systemDetail": t({
			en: "Follows your device.",
			es: "Sigue tu dispositivo.",
		}),
		"language.footer": t({
			en: "Amounts and dates keep following your device's region settings.",
			es: "Los montos y las fechas siguen la configuración regional de tu dispositivo.",
		}),
	},
} satisfies Dictionary;

export default language;
