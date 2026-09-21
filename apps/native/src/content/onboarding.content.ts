import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const onboarding = {
    content: {
        "onboarding.cover.line": t({
            en: "A ledger you keep by hand. Every entry yours, on this device.",
            es: "Un registro que llevas a mano. Cada entrada es tuya, en este dispositivo.",
        }),
        "onboarding.currency.body": t({
            en: "Everything totals in this. Change it any time — old entries keep their own.",
            es: "Todo se suma en esta moneda. Cámbiala cuando quieras; las entradas anteriores conservan la suya.",
        }),
        "onboarding.currency.change": t({
            en: "Change",
            es: "Cambiar",
        }),
        "onboarding.currency.eyebrow": t({
            en: "Currency",
            es: "Moneda",
        }),
        "onboarding.currency.openHint": t({
            en: "Opens the currency list",
            es: "Abre la lista de monedas",
        }),
        "onboarding.currency.picker.searchPlaceholder": t({
            en: "Search currencies",
            es: "Buscar monedas",
        }),
        "onboarding.currency.picker.title": t({
            en: "Select a currency",
            es: "Selecciona una moneda",
        }),
        "onboarding.currency.saveFailed.body": t({
            en: "Outlayr could not record your currency. Try again.",
            es: "Outlayr no pudo registrar tu moneda. Inténtalo de nuevo.",
        }),
        "onboarding.currency.saveFailed.title": t({
            en: "Could not save",
            es: "No se pudo guardar",
        }),
        "onboarding.currency.saving": t({
            en: "Saving…",
            es: "Guardando…",
        }),
        "onboarding.currency.shortcut": t({
            en: "I already have an account",
            es: "Ya tengo una cuenta",
        }),
        "onboarding.currency.title": t({
            en: "What are your numbers in?",
            es: "¿En qué moneda manejas tu dinero?",
        }),
        "onboarding.grounding.body": t({
            en: "For a name Outlayr has never seen, it may search the public web once to learn its category — only the merchant name, whether it is an expense or income, the entry's currency code and your language and region leave your device, never an amount, date or account. On by default; change it any time in Settings.",
            es: "Si Outlayr no conoce un comercio, puede buscarlo una vez en la web pública para saber su categoría. Solo salen de tu dispositivo el nombre del comercio, si es gasto o ingreso, el código de moneda de la entrada y tu idioma y región. Nunca un monto, una fecha ni una cuenta. Viene activado; cámbialo cuando quieras en Configuración.",
        }),
        "onboarding.grounding.eyebrow": t({
            en: "Coverage",
            es: "Cobertura",
        }),
        "onboarding.grounding.title": t({
            en: "Teach it the merchants it doesn't know",
            es: "Enséñale los comercios que no conoce",
        }),
        "onboarding.grounding.toggle": t({
            en: "Look up unfamiliar merchants",
            es: "Buscar comercios desconocidos",
        }),
        "onboarding.rhythm.body": t({
            en: "One quiet nudge each evening. iOS isn't asked for permission until your first entry is saved.",
            es: "Un aviso discreto cada noche. iOS no te pide permiso hasta que guardes tu primera entrada.",
        }),
        "onboarding.rhythm.eyebrow": t({
            en: "Rhythm",
            es: "Ritmo",
        }),
        "onboarding.rhythm.none": t({
            en: "Don't remind me",
            es: "No me recuerdes",
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
        "onboarding.rhythm.title": t({
            en: "A ledger only works if you write in it.",
            es: "Un registro solo funciona si escribes en él.",
        }),
        "onboarding.welcome.begun": t({
            en: "Begun {date}",
            es: "Comenzado el {date}",
        }),
        "onboarding.welcome.title": t({
            en: "Welcome to Outlayr",
            es: "Te damos la bienvenida a Outlayr",
        }),
    },
    key: "onboarding" as const,
} satisfies Dictionary;

export default onboarding;
