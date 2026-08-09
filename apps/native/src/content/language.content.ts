import { type Dictionary, t } from "intlayer";

const language = {
	content: {
		"language.footer": t({
			en: "Amounts and dates keep following your device's region settings.",
			es: "Los montos y las fechas siguen la configuración regional de tu dispositivo.",
		}),
		"language.system": t({
			en: "System",
			es: "Sistema",
		}),
		"language.title": t({
			en: "Language",
			es: "Idioma",
		}),
	},
	key: "language" as const,
} satisfies Dictionary;

export default language;
