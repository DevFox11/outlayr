import { type Dictionary, t } from "intlayer";

const language = {
	key: "language" as const,
	content: {
		"language.title": t({
			en: "Language",
			es: "Idioma",
		}),
		"language.system": t({
			en: "System",
			es: "Sistema",
		}),
		"language.footer": t({
			en: "Amounts and dates keep following your device's region settings.",
			es: "Los montos y las fechas siguen la configuración regional de tu dispositivo.",
		}),
	},
} satisfies Dictionary;

export default language;
