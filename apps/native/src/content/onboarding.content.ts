import { type Dictionary, t } from "intlayer";

const onboarding = {
	key: "onboarding" as const,
	content: {
		"onboarding.welcome.begun": t({
			en: "Begun {date}",
			es: "Comenzado el {date}",
		}),
		"onboarding.welcome.title": t({
			en: "Welcome to Outlayr",
			es: "Bienvenido a Outlayr",
		}),
		"onboarding.cover.line": t({
			en: "A ledger you keep by hand. Every entry yours, on this device.",
			es: "Un registro que llevas a mano. Cada entrada es tuya, en este dispositivo.",
		}),
		"onboarding.currency.eyebrow": t({
			en: "Currency",
			es: "Moneda",
		}),
		"onboarding.currency.title": t({
			en: "What are your numbers in?",
			es: "¿En qué moneda están tus números?",
		}),
		"onboarding.currency.body": t({
			en: "Everything totals in this. Change it any time — old entries keep their own.",
			es: "Todo se suma en esta. Cámbiala cuando quieras — las entradas viejas conservan la suya.",
		}),
		"onboarding.currency.openHint": t({
			en: "Opens the currency list",
			es: "Abre la lista de monedas",
		}),
		"onboarding.currency.change": t({
			en: "Change",
			es: "Cambiar",
		}),
		"onboarding.currency.saving": t({
			en: "Saving…",
			es: "Guardando…",
		}),
		"onboarding.currency.saveFailed.title": t({
			en: "Could not save",
			es: "No se pudo guardar",
		}),
		"onboarding.currency.saveFailed.body": t({
			en: "Outlayr could not record your currency. Try again.",
			es: "Outlayr no pudo registrar tu moneda. Inténtalo de nuevo.",
		}),
		"onboarding.currency.picker.title": t({
			en: "Select a currency",
			es: "Selecciona una moneda",
		}),
		"onboarding.currency.picker.searchPlaceholder": t({
			en: "Search currencies",
			es: "Buscar monedas",
		}),
		"onboarding.currency.shortcut": t({
			en: "I already have an account",
			es: "Ya tengo una cuenta",
		}),
		"onboarding.rhythm.eyebrow": t({
			en: "Rhythm",
			es: "Ritmo",
		}),
		"onboarding.rhythm.title": t({
			en: "A ledger only works if you write in it.",
			es: "Un registro solo funciona si escribes en él.",
		}),
		"onboarding.rhythm.body": t({
			en: "One quiet nudge each evening. iOS isn't asked for permission until your first entry is saved.",
			es: "Un aviso discreto cada tarde. No se le pide permiso a iOS hasta que guardes tu primera entrada.",
		}),
		"onboarding.rhythm.notifToday": t({
			en: "Time to write today's lines.",
			es: "Hora de escribir las líneas de hoy.",
		}),
		"onboarding.rhythm.notifYesterday": t({
			en: "Yesterday you wrote 3 lines.",
			es: "Ayer escribiste 3 líneas.",
		}),
		"onboarding.rhythm.remind": t({
			en: "Remind me at {time}",
			es: "Recuérdame a las {time}",
		}),
		"onboarding.rhythm.none": t({
			en: "Don't remind me",
			es: "No me recuerdes",
		}),
	},
} satisfies Dictionary;

export default onboarding;
