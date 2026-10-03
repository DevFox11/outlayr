import { insert, t } from "intlayer";
import type { Dictionary } from "intlayer";

import { ACCOUNTS_SCREEN_ALT, RECEIPT_SCAN_ANSWER } from "./shared";

const OUTLAYR_LEAD = {
    en: "Outlayr is a free expense tracker you fill in by sentence, voice, or receipt.",
    es: "Outlayr es una app gratis para controlar tus gastos que llenas con una oración, con tu voz o con un recibo.",
} as const;

const OUTLAYR = {
    budgets: t({
        en: "A limit per category or per month, with where the pace ends",
        es: "Un límite por categoría o por mes, y a dónde te lleva el ritmo",
    }),
    currencies: t({ en: "165, converted at the rate of the day", es: "165, convertidas con la tasa del día" }),
    entries: t({
        en: "One sentence, voice, receipt scan, CSV import",
        es: "Una oración, voz, escaneo de recibos, importación de CSV",
    }),
    focus: t({
        en: "Daily spending, budgets, and savings goals",
        es: "Gastos diarios, presupuestos y metas de ahorro",
    }),
    platforms: t({ en: "iPhone. Android soon", es: "iPhone. Pronto en Android" }),
    price: t({ en: "Free. Pro monthly, yearly, or once", es: "Gratis. Pro al mes, al año o en un solo pago" }),
};

const LABELS = {
    budgets: t({ en: "Budgets", es: "Presupuestos" }),
    currencies: t({ en: "Currencies", es: "Monedas" }),
    entries: t({ en: "Adding entries", es: "Cómo registras" }),
    focus: t({ en: "Tracks", es: "Sigue" }),
    platforms: t({ en: "Runs on", es: "Funciona en" }),
    price: t({ en: "Price", es: "Precio" }),
};

const START_FREE = t({ en: "Want to start free", es: "Quieres empezar gratis" });
const SAY_OR_SCAN = t({
    en: "Would rather say or scan a purchase than fill in a form",
    es: "Prefieres dictar o escanear una compra en vez de llenar un formulario",
});
const SEVERAL_CURRENCIES = t({ en: "Spend in more than one currency", es: "Gastas en más de una moneda" });
const SYNC_ACCOUNTS = t({
    en: "Want linked accounts to sync on their own",
    es: "Quieres que tus cuentas vinculadas se sincronicen solas",
});

const answers = {
    content: {
        compare: {
            copilot: {
                fit: {
                    outlayr: [
                        START_FREE,
                        t({ en: "Live outside the United States", es: "Vives fuera de Estados Unidos" }),
                        SAY_OR_SCAN,
                    ],
                    rival: [
                        SYNC_ACCOUNTS,
                        t({
                            en: "Use a Mac or an iPad as much as your phone",
                            es: "Usas una Mac o un iPad tanto como tu celular",
                        }),
                        t({ en: "Want a web app today", es: "Quieres una app web hoy" }),
                    ],
                },
                lead: t({
                    en: `${OUTLAYR_LEAD.en} Copilot is a paid money app for Apple devices and the web that syncs linked accounts.`,
                    es: `${OUTLAYR_LEAD.es} Copilot es una app de finanzas de pago para dispositivos Apple y la web que sincroniza cuentas vinculadas.`,
                }),
                meta: {
                    title: t({
                        en: "Outlayr vs Copilot Money: Price, Currencies, Platforms",
                        es: "Outlayr vs Copilot Money: precio, monedas y plataformas",
                    }),
                },
                rival: "Copilot",
                rows: [
                    {
                        label: LABELS.price,
                        outlayr: OUTLAYR.price,
                        rival: t({
                            en: "$13 a month or $95 a year, after a free trial",
                            es: "$13 al mes o $95 al año, después de una prueba gratis",
                        }),
                    },
                    {
                        label: LABELS.entries,
                        outlayr: OUTLAYR.entries,
                        rival: t({ en: "Synced from linked accounts", es: "Sincronizados desde cuentas vinculadas" }),
                    },
                    {
                        label: LABELS.currencies,
                        outlayr: OUTLAYR.currencies,
                        rival: t({ en: "US dollars only", es: "Solo dólares estadounidenses" }),
                    },
                    {
                        label: LABELS.platforms,
                        outlayr: OUTLAYR.platforms,
                        rival: t({ en: "iPhone, iPad, Mac, web", es: "iPhone, iPad, Mac, web" }),
                    },
                ],
                site: "copilot.money",
                title: t({ en: "Outlayr and Copilot, side by side.", es: "Outlayr y Copilot, lado a lado." }),
            },
            monarch: {
                fit: {
                    outlayr: [
                        START_FREE,
                        t({
                            en: "Live outside the United States and Canada",
                            es: "Vives fuera de Estados Unidos y Canadá",
                        }),
                        SEVERAL_CURRENCIES,
                    ],
                    rival: [
                        SYNC_ACCOUNTS,
                        t({
                            en: "Track investments alongside spending",
                            es: "Sigues tus inversiones junto con tus gastos",
                        }),
                        t({ en: "Need Android or a web app today", es: "Necesitas Android o una app web hoy" }),
                    ],
                },
                lead: t({
                    en: `${OUTLAYR_LEAD.en} Monarch is a paid money dashboard that syncs linked accounts in the United States and Canada.`,
                    es: `${OUTLAYR_LEAD.es} Monarch es un panel de finanzas de pago que sincroniza cuentas vinculadas en Estados Unidos y Canadá.`,
                }),
                meta: {
                    title: t({
                        en: "Outlayr vs Monarch Money: Price, Currencies, Platforms",
                        es: "Outlayr vs Monarch Money: precio, monedas y plataformas",
                    }),
                },
                rival: "Monarch",
                rows: [
                    {
                        label: LABELS.price,
                        outlayr: OUTLAYR.price,
                        rival: t({
                            en: "$14.99 a month or $99.99 a year, after a 7-day trial",
                            es: "$14.99 al mes o $99.99 al año, después de una prueba de 7 días",
                        }),
                    },
                    {
                        label: LABELS.entries,
                        outlayr: OUTLAYR.entries,
                        rival: t({ en: "Synced from linked accounts", es: "Sincronizados desde cuentas vinculadas" }),
                    },
                    {
                        label: LABELS.focus,
                        outlayr: OUTLAYR.focus,
                        rival: t({
                            en: "Budgets, net worth, and investments across linked accounts",
                            es: "Presupuestos, patrimonio e inversiones en tus cuentas vinculadas",
                        }),
                    },
                    {
                        label: LABELS.platforms,
                        outlayr: OUTLAYR.platforms,
                        rival: t({ en: "iPhone, Android, web", es: "iPhone, Android, web" }),
                    },
                ],
                site: "monarch.com",
                title: t({ en: "Outlayr and Monarch, side by side.", es: "Outlayr y Monarch, lado a lado." }),
            },
            ynab: {
                fit: {
                    outlayr: [START_FREE, SEVERAL_CURRENCIES, SAY_OR_SCAN],
                    rival: [
                        t({
                            en: "Want your bank to import transactions",
                            es: "Quieres que tu banco importe los movimientos",
                        }),
                        t({
                            en: "Follow the give every dollar a job method",
                            es: "Sigues el método de darle un trabajo a cada dólar",
                        }),
                        t({ en: "Need Android or a web app today", es: "Necesitas Android o una app web hoy" }),
                    ],
                },
                lead: t({
                    en: `${OUTLAYR_LEAD.en} YNAB is a paid budgeting method built on bank imports.`,
                    es: `${OUTLAYR_LEAD.es} YNAB es un método de presupuesto de pago basado en importar movimientos del banco.`,
                }),
                meta: {
                    title: t({
                        en: "Outlayr vs YNAB: Price, Currencies, Platforms",
                        es: "Outlayr vs YNAB: precio, monedas y plataformas",
                    }),
                },
                rival: "YNAB",
                rows: [
                    {
                        label: LABELS.price,
                        outlayr: OUTLAYR.price,
                        rival: t({
                            en: "$14.99 a month or $109 a year, after a 34-day trial",
                            es: "$14.99 al mes o $109 al año, después de una prueba de 34 días",
                        }),
                    },
                    {
                        label: LABELS.entries,
                        outlayr: OUTLAYR.entries,
                        rival: t({
                            en: "Bank import for select US, Canadian, UK, and EU banks, file import, or by hand",
                            es: "Importación desde algunos bancos de EE. UU., Canadá, Reino Unido y la UE, importación de archivos o a mano",
                        }),
                    },
                    {
                        label: LABELS.budgets,
                        outlayr: OUTLAYR.budgets,
                        rival: t({
                            en: "A spending plan that gives every dollar a job",
                            es: "Un plan de gastos que le da un trabajo a cada dólar",
                        }),
                    },
                    {
                        label: LABELS.currencies,
                        outlayr: OUTLAYR.currencies,
                        rival: t({ en: "One per spending plan", es: "Una por plan de gastos" }),
                    },
                    {
                        label: LABELS.platforms,
                        outlayr: OUTLAYR.platforms,
                        rival: t({ en: "iPhone, Android, web", es: "iPhone, Android, web" }),
                    },
                ],
                site: "ynab.com",
                title: t({ en: "Outlayr and YNAB, side by side.", es: "Outlayr y YNAB, lado a lado." }),
            },
        },
        guides: {
            "apple-pay-expense-tracker": {
                facts: [
                    {
                        label: t({ en: "Trigger", es: "Disparador" }),
                        text: t({
                            en: "A Wallet automation in the Shortcuts app",
                            es: "Una automatización de Wallet en la app Atajos",
                        }),
                    },
                    {
                        label: t({ en: "Logged", es: "Registra" }),
                        text: t({
                            en: "The amount, the merchant, and the card you paid with",
                            es: "El monto, el comercio y la tarjeta con la que pagaste",
                        }),
                    },
                    {
                        label: t({ en: "Cards", es: "Tarjetas" }),
                        text: t({
                            en: "Each card files under the account you choose",
                            es: "Cada tarjeta se registra en la cuenta que elijas",
                        }),
                    },
                    {
                        label: t({ en: "Setup", es: "Configuración" }),
                        text: t({
                            en: "In Settings, under Apple Pay. On iOS 27, one shortcut installs it",
                            es: "En Configuración, en Apple Pay. En iOS 27, un atajo la instala",
                        }),
                    },
                    {
                        label: t({ en: "Bank apps", es: "Apps de banco" }),
                        text: t({
                            en: "A purchase notification from a bank app can log the same way",
                            es: "La notificación de compra de la app de tu banco puede registrarse igual",
                        }),
                    },
                    {
                        label: t({ en: "Runs on", es: "Funciona en" }),
                        text: "iPhone",
                    },
                ],
                faq: [
                    {
                        answer: t({
                            en: "Yes, on iPhone. Once the Shortcuts automation is on, each Apple Pay tap is logged in Outlayr with its amount and merchant.",
                            es: "Sí, en iPhone. Cuando la automatización de Atajos está activa, cada pago con Apple Pay se registra en Outlayr con su monto y su comercio.",
                        }),
                        question: t({
                            en: "Does Outlayr log Apple Pay purchases automatically?",
                            es: "¿Outlayr registra las compras con Apple Pay automáticamente?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Each card you pay with shows up in Settings, under Apple Pay. You choose the account its purchases go to.",
                            es: "Cada tarjeta con la que pagas aparece en Configuración, en Apple Pay. Tú eliges a qué cuenta van sus compras.",
                        }),
                        question: t({
                            en: "Which account does an Apple Pay purchase go to?",
                            es: "¿A qué cuenta va una compra con Apple Pay?",
                        }),
                    },
                    {
                        answer: t({
                            en: "A second automation reads the purchase notification from your bank's app and logs the amount and the merchant from its text.",
                            es: "Una segunda automatización lee la notificación de compra de la app de tu banco y registra el monto y el comercio a partir del texto.",
                        }),
                        question: t({
                            en: "What about cards that are not in Apple Pay?",
                            es: "¿Y las tarjetas que no están en Apple Pay?",
                        }),
                    },
                ],
                lead: t({
                    en: "On iPhone, Outlayr logs each Apple Pay purchase when you tap your card. A Shortcuts automation sends the amount, the merchant, and the card to the Log.",
                    es: "En iPhone, Outlayr registra cada compra con Apple Pay cuando acercas tu tarjeta. Una automatización de Atajos envía el monto, el comercio y la tarjeta al Registro.",
                }),
                meta: {
                    title: t({
                        en: "Apple Pay Expense Tracker: Log Each Tap · Outlayr",
                        es: "Control de gastos con Apple Pay: registra cada pago · Outlayr",
                    }),
                },
                plateAlt: t({
                    en: "Outlayr Log showing a $42.00 Costco purchase logged today, above the entries from earlier days.",
                    es: "Registro de Outlayr con una compra de $42.00 en Costco registrada hoy, arriba de los registros de días anteriores.",
                }),
                steps: [
                    {
                        text: t({
                            en: "On iOS 27, get the shortcut. On earlier versions, follow the steps there to add the automation by hand.",
                            es: "En iOS 27, obtén el atajo. En versiones anteriores, sigue los pasos que aparecen ahí para agregar la automatización a mano.",
                        }),
                        title: t({ en: "Open Settings, then Apple Pay", es: "Abre Configuración y luego Apple Pay" }),
                    },
                    {
                        text: t({
                            en: "The automation arrives turned off. Turn it on and pick the cards that should log.",
                            es: "La automatización llega desactivada. Actívala y elige las tarjetas que se van a registrar.",
                        }),
                        title: t({ en: "Turn it on in Shortcuts", es: "Actívala en Atajos" }),
                    },
                    {
                        text: t({
                            en: "Each tap lands on the Log. The card then shows up in Settings, where you choose its account.",
                            es: "Cada pago llega al Registro. La tarjeta aparece después en Configuración, donde eliges su cuenta.",
                        }),
                        title: t({ en: "Pay as usual", es: "Paga como siempre" }),
                    },
                ],
                title: t({
                    en: "Log Apple Pay purchases as you pay.",
                    es: "Registra tus compras con Apple Pay al pagar.",
                }),
            },
            "multi-currency-expense-tracker": {
                facts: [
                    {
                        label: t({ en: "Currencies", es: "Monedas" }),
                        text: t({
                            en: "165, from the US dollar to the Venezuelan bolívar",
                            es: "165, del dólar estadounidense al bolívar venezolano",
                        }),
                    },
                    {
                        label: t({ en: "Rate", es: "Tasa" }),
                        text: t({
                            en: "From the day of the purchase, or one you type",
                            es: "La del día de la compra, o una que escribas",
                        }),
                    },
                    {
                        label: t({ en: "Accounts", es: "Cuentas" }),
                        text: t({
                            en: "Each keeps its own currency and balance",
                            es: "Cada una tiene su propia moneda y su saldo",
                        }),
                    },
                    {
                        label: t({ en: "Transfers", es: "Transferencias" }),
                        text: t({
                            en: "Move money between currencies without counting it as spending",
                            es: "Mueve dinero entre monedas sin que cuente como gasto",
                        }),
                    },
                    {
                        label: t({ en: "Totals", es: "Totales" }),
                        text: t({
                            en: "Budgets and insights read in your main currency",
                            es: "Los presupuestos y las estadísticas se leen en tu moneda principal",
                        }),
                    },
                    {
                        label: t({ en: "Free plan", es: "Plan gratis" }),
                        text: t({
                            en: "Log in any currency. Accounts in one currency, more with Pro",
                            es: "Registra en cualquier moneda. Cuentas en una moneda, más con Pro",
                        }),
                    },
                ],
                faq: [
                    {
                        answer: t({
                            en: "The rate from the day of the purchase. Entries you already logged do not change when the rate moves. You can type your own rate when the one you got was different.",
                            es: "La tasa del día de la compra. Los registros que ya hiciste no cambian cuando la tasa se mueve. Puedes escribir tu propia tasa cuando la que te dieron fue distinta.",
                        }),
                        question: t({
                            en: "Which exchange rate does Outlayr use?",
                            es: "¿Qué tasa de cambio usa Outlayr?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes. A dollar card, a bolívar bank account, and cash in euros each keep their own balance, and a transfer between them does not count as spending. The free plan holds accounts in one currency. Outlayr Pro allows any number.",
                            es: "Sí. Una tarjeta en dólares, una cuenta de banco en bolívares y efectivo en euros tienen cada uno su propio saldo, y una transferencia entre ellos no cuenta como gasto. El plan gratis permite cuentas en una moneda. Outlayr Pro permite las que quieras.",
                        }),
                        question: t({
                            en: "Can each account hold its own currency?",
                            es: "¿Cada cuenta puede tener su propia moneda?",
                        }),
                    },
                    {
                        answer: t({
                            en: "165. You can log a purchase in any of them on the free plan.",
                            es: "165. Puedes registrar una compra en cualquiera de ellas con el plan gratis.",
                        }),
                        question: t({
                            en: "How many currencies does Outlayr support?",
                            es: "¿Cuántas monedas admite Outlayr?",
                        }),
                    },
                ],
                lead: t({
                    en: "Outlayr logs a purchase in any of 165 currencies and converts totals to your main currency at the rate from the day it happened.",
                    es: "Outlayr registra una compra en cualquiera de 165 monedas y convierte los totales a tu moneda principal con la tasa del día de la compra.",
                }),
                meta: {
                    title: t({
                        en: "Multi-Currency Expense Tracker: 165 Currencies · Outlayr",
                        es: "Control de gastos en varias monedas: 165 monedas · Outlayr",
                    }),
                },
                plateAlt: ACCOUNTS_SCREEN_ALT,
                steps: [
                    {
                        text: t({
                            en: "Every total, budget, and chart reads in it.",
                            es: "Todos los totales, presupuestos y gráficos se leen en ella.",
                        }),
                        title: t({ en: "Pick your main currency", es: "Elige tu moneda principal" }),
                    },
                    {
                        text: t({
                            en: "Tap the currency in the sentence and pick the one on the receipt.",
                            es: "Toca la moneda en la oración y elige la del recibo.",
                        }),
                        title: t({ en: "Log in the currency you paid", es: "Registra en la moneda en que pagaste" }),
                    },
                    {
                        text: t({
                            en: "Each entry converts at the rate from its own day.",
                            es: "Cada registro se convierte con la tasa de su propio día.",
                        }),
                        title: t({ en: "Read one total", es: "Lee un solo total" }),
                    },
                ],
                title: t({
                    en: "Track expenses in more than one currency.",
                    es: "Registra gastos en más de una moneda.",
                }),
            },
            "receipt-scanner": {
                facts: [
                    {
                        label: t({ en: "Reads", es: "Lee" }),
                        text: t({
                            en: "The store, the date, the total, and every line",
                            es: "La tienda, la fecha, el total y cada línea",
                        }),
                    },
                    {
                        label: t({ en: "From", es: "Desde" }),
                        text: t({
                            en: "The camera, or a photo in your library",
                            es: "La cámara o una foto de tu galería",
                        }),
                    },
                    {
                        label: t({ en: "Review", es: "Revisión" }),
                        text: t({
                            en: "The entry comes back filled in for you to check and save",
                            es: "El registro vuelve lleno para que lo revises y lo guardes",
                        }),
                    },
                    {
                        label: t({ en: "Free plan", es: "Plan gratis" }),
                        text: t({
                            en: "20 captures every 30 days, shared with voice entry",
                            es: "20 capturas cada 30 días, compartidas con los registros por voz",
                        }),
                    },
                    {
                        label: "Pro",
                        text: t({
                            en: "500 captures every 30 days, and receipt photo backup",
                            es: "500 capturas cada 30 días y respaldo de las fotos de tus recibos",
                        }),
                    },
                    {
                        label: t({ en: "Needs", es: "Requiere" }),
                        text: t({ en: "An account and a connection", es: "Una cuenta y conexión" }),
                    },
                ],
                faq: [
                    {
                        answer: RECEIPT_SCAN_ANSWER,
                        question: t({
                            en: "How does receipt scanning work?",
                            es: "¿Cómo funciona el escaneo de recibos?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes, up to a limit. The free plan includes 20 captures every 30 days, and a capture is one receipt scan or one voice entry. Outlayr Pro raises that to 500.",
                            es: "Sí, hasta un límite. El plan gratis incluye 20 capturas cada 30 días, y una captura es un escaneo de recibo o un registro por voz. Outlayr Pro lo sube a 500.",
                        }),
                        question: t({ en: "Is receipt scanning free?", es: "¿Escanear recibos es gratis?" }),
                    },
                    {
                        answer: t({
                            en: "No. Scanning a receipt needs a connection. Typing an entry works with no signal.",
                            es: "No. Para escanear un recibo necesitas conexión. Escribir un registro funciona sin señal.",
                        }),
                        question: t({
                            en: "Does receipt scanning work offline?",
                            es: "¿El escaneo de recibos funciona sin conexión?",
                        }),
                    },
                ],
                lead: t({
                    en: "Take a photo of a receipt and Outlayr reads the store, the date, the total, and every line, then fills in the entry for you to save.",
                    es: "Toma una foto de un recibo y Outlayr lee la tienda, la fecha, el total y cada línea, y llena el registro para que lo guardes.",
                }),
                meta: {
                    title: t({
                        en: "Receipt Scanner App: Photo to Expense · Outlayr",
                        es: "Escáner de recibos: de la foto al gasto · Outlayr",
                    }),
                },
                plateAlt: t({
                    en: "A Target receipt read into an entry: store, date, total, and category, then saved to the Log.",
                    es: "Un recibo de Target convertido en un registro: tienda, fecha, total y categoría, y luego guardado en el Registro.",
                }),
                steps: [
                    {
                        text: t({
                            en: "Take a photo, or pick one from your library.",
                            es: "Toma una foto o elige una de tu galería.",
                        }),
                        title: t({ en: "Tap Scan a receipt", es: "Toca Escanear un recibo" }),
                    },
                    {
                        text: t({
                            en: "The store, the date, and the total come back filled in.",
                            es: "La tienda, la fecha y el total vuelven llenos.",
                        }),
                        title: t({ en: "Check the entry", es: "Revisa el registro" }),
                    },
                    {
                        text: t({
                            en: "It lands on the Log, and your budgets update.",
                            es: "Llega al Registro y tus presupuestos se actualizan.",
                        }),
                        title: t({ en: "Save", es: "Guarda" }),
                    },
                ],
                title: t({ en: "Scan a receipt into an expense.", es: "Convierte un recibo en un gasto." }),
            },
        },
        labels: {
            feature: t({ en: "Feature", es: "Función" }),
            fit: t({ en: "Which one fits", es: "Cuál te conviene" }),
            fitHeading: insert(t({ en: "{{name}}, if you", es: "{{name}}, si" })),
            questions: t({ en: "Questions", es: "Preguntas" }),
            source: insert(
                t({
                    en: "{{name}} details from {{site}}, checked 3 October 2026.",
                    es: "Datos de {{name}} tomados de {{site}}, revisados el 3 de octubre de 2026.",
                })
            ),
            steps: t({ en: "How it works", es: "Cómo funciona" }),
        },
    },
    key: "answers",
} satisfies Dictionary;

export default answers;
