import { type Dictionary, t } from "intlayer";

const language = {
	content: {
		// The system date and time pickers are SwiftUI, so they read the device
		// language rather than this setting; the footer has to say so, because the
		// amounts beside them do follow it.
		"language.footer": t({
			en: "Amounts and dates follow this setting. System date and time pickers follow your device language.",
			es: "Los montos y las fechas siguen este ajuste. Los selectores de fecha y hora del sistema siguen el idioma de tu dispositivo.",
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
