import { type Dictionary, t } from "intlayer";

const onboarding = {
	key: "onboarding" as const,
	content: {
		"onboarding.welcome.eyebrow": t({
			en: "Welcome",
			es: "Bienvenido",
		}),
		"onboarding.welcome.subtitle": t({
			en: "A ledger you keep by hand — every entry yours, on this device.",
			es: "Un registro que llevas a mano — cada entrada es tuya, en este dispositivo.",
		}),
		"onboarding.welcome.feature.track.title": t({
			en: "Track your finances",
			es: "Controla tus finanzas",
		}),
		"onboarding.welcome.feature.track.body": t({
			en: "Add new entries in a simple, straightforward manner",
			es: "Agrega nuevos registros de forma simple y directa",
		}),
		"onboarding.welcome.feature.analyse.title": t({
			en: "Analyse your expenditure",
			es: "Analiza tu gasto",
		}),
		"onboarding.welcome.feature.analyse.body": t({
			en: "Draw insights from your spending over various time periods",
			es: "Obtén estadísticas de tus gastos en distintos períodos de tiempo",
		}),
		"onboarding.welcome.feature.budgets.title": t({
			en: "Stick to budgets",
			es: "Cumple con tus presupuestos",
		}),
		"onboarding.welcome.feature.budgets.body": t({
			en: "Set categorical and time-based goals to limit your spending",
			es: "Establece metas por categoría y período de tiempo para limitar tus gastos",
		}),
		"onboarding.welcome.start": t({
			en: "Get Started",
			es: "Comenzar",
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
			en: "Outlayr converts between currencies to total your ledger, so it has to know what your entries already mean. It asks once rather than guessing — a guess it later froze into your records could not be undone.",
			es: "Outlayr convierte entre monedas para sumar tu registro, así que necesita saber qué significan tus entradas. Lo pregunta una vez en lugar de adivinar — una suposición congelada en tus registros no se podría deshacer.",
		}),
		"onboarding.currency.openHint": t({
			en: "Opens the currency list",
			es: "Abre la lista de monedas",
		}),
		"onboarding.currency.change": t({
			en: "Change",
			es: "Cambiar",
		}),
		"onboarding.currency.later": t({
			en: "You can change this later in Settings.",
			es: "Puedes cambiar esto después en Configuración.",
		}),
		"onboarding.currency.saving": t({
			en: "Saving…",
			es: "Guardando…",
		}),
		"onboarding.currency.start": t({
			en: "Start",
			es: "Comenzar",
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
	},
} satisfies Dictionary;

export default onboarding;
