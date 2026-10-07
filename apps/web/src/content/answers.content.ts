import { insert, t } from "intlayer";
import type { Dictionary } from "intlayer";

import { ACCOUNTS_SCREEN_ALT, BUDGETS_SCREEN_ALT, RECEIPT_SCAN_ANSWER } from "./shared";

const OUTLAYR_LEAD = {
    en: "Outlayr is a free expense tracker you fill in by sentence, voice, or receipt.",
    es: "Outlayr es una app gratis para controlar tus gastos que llenas con una oración, con tu voz o con un recibo.",
} as const;

const RIVALS = {
    copilot: {
        en: "Copilot is a paid money app for Apple devices and the web that syncs linked accounts.",
        es: "Copilot es una app de finanzas de pago para dispositivos Apple y la web que sincroniza cuentas vinculadas.",
    },
    rocketMoney: {
        en: "Rocket Money is a subscription and budget app for the United States that syncs linked accounts and cancels subscriptions as a Premium feature.",
        es: "Rocket Money es una app de suscripciones y presupuesto para Estados Unidos que sincroniza cuentas vinculadas y cancela suscripciones como función Premium.",
    },
    monarch: {
        en: "Monarch is a paid money dashboard that syncs linked accounts in the United States and Canada.",
        es: "Monarch es un panel de finanzas de pago que sincroniza cuentas vinculadas en Estados Unidos y Canadá.",
    },
    ynab: {
        en: "YNAB is a paid budgeting method built on bank imports.",
        es: "YNAB es un método de presupuesto de pago basado en importar movimientos del banco.",
    },
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
    availability: t({ en: "Available in", es: "Disponible en" }),
    budgets: t({ en: "Budgets", es: "Presupuestos" }),
    currencies: t({ en: "Currencies", es: "Monedas" }),
    entries: t({ en: "Adding entries", es: "Cómo registras" }),
    focus: t({ en: "Tracks", es: "Sigue" }),
    platforms: t({ en: "Runs on", es: "Funciona en" }),
    price: t({ en: "Price", es: "Precio" }),
    subscriptions: t({ en: "Subscriptions", es: "Suscripciones" }),
};

const COST_FAQ = {
    answer: t({
        en: "The tracker is free, with budgets, goals, subscriptions, and widgets. The free plan includes 20 voice or receipt captures every 30 days, 2 accounts, 2 category budgets, and accounts in one currency. Outlayr Pro raises those limits and adds sync. It is billed monthly or yearly, or bought once, at prices set per country in the App Store.",
        es: "El control de gastos es gratis, con presupuestos, metas, suscripciones y widgets. El plan gratis incluye 20 capturas de voz o de recibos cada 30 días, 2 cuentas, 2 presupuestos por categoría y cuentas en una moneda. Outlayr Pro sube esos límites y agrega la sincronización. Se paga al mes, al año o en un solo pago, con precios por país en el App Store.",
    }),
    question: t({ en: "How much does Outlayr cost?", es: "¿Cuánto cuesta Outlayr?" }),
};

const START_FREE = t({ en: "Want to start free", es: "Quieres empezar gratis" });
const SAY_OR_SCAN = t({
    en: "Would rather say or scan a purchase than fill in a form",
    es: "Prefieres dictar o escanear una compra en vez de llenar un formulario",
});
const OUTSIDE_US = t({ en: "Live outside the United States", es: "Vives fuera de Estados Unidos" });
const SEVERAL_CURRENCIES = t({ en: "Spend in more than one currency", es: "Gastas en más de una moneda" });
const SYNC_ACCOUNTS = t({
    en: "Want linked accounts to sync on their own",
    es: "Quieres que tus cuentas vinculadas se sincronicen solas",
});

const answers = {
    content: {
        compare: {
            copilot: {
                faq: [
                    {
                        answer: t({
                            en: "It is if you want to start free, live outside the United States, or would rather say or scan a purchase than type it. Copilot fits better if you want linked accounts to sync on their own, or use it on a Mac or an iPad.",
                            es: "Sí, si quieres empezar gratis, vives fuera de Estados Unidos o prefieres dictar o escanear una compra en vez de escribirla. Copilot te conviene más si quieres que tus cuentas vinculadas se sincronicen solas, o si lo usas en una Mac o un iPad.",
                        }),
                        question: t({
                            en: "Is Outlayr a good Copilot alternative?",
                            es: "¿Outlayr es una buena alternativa a Copilot?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes, 165 of them, converted to your main currency at the rate from the day of each purchase. Copilot supports US dollars only.",
                            es: "Sí, 165, convertidas a tu moneda principal con la tasa del día de cada compra. Copilot solo admite dólares estadounidenses.",
                        }),
                        question: t({
                            en: "Does Outlayr support currencies other than US dollars?",
                            es: "¿Outlayr admite monedas además del dólar estadounidense?",
                        }),
                    },
                    COST_FAQ,
                ],
                fit: {
                    outlayr: [START_FREE, OUTSIDE_US, SAY_OR_SCAN],
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
                    en: `${OUTLAYR_LEAD.en} ${RIVALS.copilot.en}`,
                    es: `${OUTLAYR_LEAD.es} ${RIVALS.copilot.es}`,
                }),
                meta: {
                    title: t({
                        en: "Copilot Money Alternative: Outlayr vs Copilot (Price, Currencies)",
                        es: "Alternativa a Copilot Money: Outlayr vs Copilot (precio y monedas)",
                    }),
                },
                rival: "Copilot",
                rows: [
                    {
                        label: LABELS.price,
                        outlayr: OUTLAYR.price,
                        rival: t({
                            en: "$13 a month or $95 a year, after a 1-month free trial",
                            es: "$13 al mes o $95 al año, después de una prueba gratis de 1 mes",
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
                source: "https://www.copilot.money/faq",
                summary: t(RIVALS.copilot),
                title: t({ en: "Outlayr as a Copilot alternative.", es: "Outlayr como alternativa a Copilot." }),
            },
            monarch: {
                faq: [
                    {
                        answer: t({
                            en: "It is if you want to start free, live outside the United States and Canada, or spend in more than one currency. Monarch fits better if you want linked accounts to sync on their own, or track investments next to spending.",
                            es: "Sí, si quieres empezar gratis, vives fuera de Estados Unidos y Canadá o gastas en más de una moneda. Monarch te conviene más si quieres que tus cuentas vinculadas se sincronicen solas, o seguir tus inversiones junto con tus gastos.",
                        }),
                        question: t({
                            en: "Is Outlayr a good Monarch alternative?",
                            es: "¿Outlayr es una buena alternativa a Monarch?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes. Outlayr is offered in all 175 App Store countries and regions, in English and Spanish. Monarch is available in the United States and Canada.",
                            es: "Sí. Outlayr se ofrece en los 175 países y regiones del App Store, en inglés y en español. Monarch está disponible en Estados Unidos y Canadá.",
                        }),
                        question: t({
                            en: "Is Outlayr available outside the United States and Canada?",
                            es: "¿Outlayr está disponible fuera de Estados Unidos y Canadá?",
                        }),
                    },
                    COST_FAQ,
                ],
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
                    en: `${OUTLAYR_LEAD.en} ${RIVALS.monarch.en}`,
                    es: `${OUTLAYR_LEAD.es} ${RIVALS.monarch.es}`,
                }),
                meta: {
                    title: t({
                        en: "Monarch Money Alternative: Outlayr vs Monarch (Price, Platforms)",
                        es: "Alternativa a Monarch Money: Outlayr vs Monarch (precio y plataformas)",
                    }),
                },
                rival: "Monarch",
                rows: [
                    {
                        label: LABELS.price,
                        outlayr: OUTLAYR.price,
                        rival: t({
                            en: "$14.99 a month or $99.99 a year, after a 7-day trial. Plus is $199.99 a year",
                            es: "$14.99 al mes o $99.99 al año, después de una prueba de 7 días. Plus cuesta $199.99 al año",
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
                        rival: t({ en: "iPhone, iPad, Android, web", es: "iPhone, iPad, Android, web" }),
                    },
                ],
                site: "monarch.com",
                source: "https://www.monarch.com/pricing",
                summary: t(RIVALS.monarch),
                title: t({ en: "Outlayr as a Monarch alternative.", es: "Outlayr como alternativa a Monarch." }),
            },
            "rocket-money": {
                faq: [
                    {
                        answer: t({
                            en: "It is if you want to start free, live outside the United States, or spend in more than one currency. Rocket Money fits better if you want linked accounts to sync on their own, or want its team to cancel subscriptions for you.",
                            es: "Sí, si quieres empezar gratis, vives fuera de Estados Unidos o gastas en más de una moneda. Rocket Money te conviene más si quieres que tus cuentas vinculadas se sincronicen solas, o que su equipo cancele suscripciones por ti.",
                        }),
                        question: t({
                            en: "Is Outlayr a good Rocket Money alternative?",
                            es: "¿Outlayr es una buena alternativa a Rocket Money?",
                        }),
                    },
                    {
                        answer: t({
                            en: "No. Outlayr shows what each subscription costs and when it charges next, and can remind you before the charge, so you cancel with the service yourself. At Rocket Money, cancellation by its team is a Premium feature.",
                            es: "No. Outlayr te muestra cuánto cuesta cada suscripción y cuándo vuelve a cobrar, y puede avisarte antes del cobro, para que la canceles tú con el servicio. En Rocket Money, la cancelación por su equipo es una función Premium.",
                        }),
                        question: t({
                            en: "Does Outlayr cancel subscriptions like Rocket Money?",
                            es: "¿Outlayr cancela suscripciones como Rocket Money?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes. Outlayr is offered in all 175 App Store countries and regions, with 165 currencies, in English and Spanish. Rocket Money is available in the United States, with U.S. banks.",
                            es: "Sí. Outlayr se ofrece en los 175 países y regiones del App Store, con 165 monedas, en inglés y en español. Rocket Money está disponible en Estados Unidos, con bancos de EE. UU.",
                        }),
                        question: t({
                            en: "Does Outlayr work outside the United States?",
                            es: "¿Outlayr funciona fuera de Estados Unidos?",
                        }),
                    },
                    COST_FAQ,
                ],
                fit: {
                    outlayr: [START_FREE, OUTSIDE_US, SEVERAL_CURRENCIES],
                    rival: [
                        SYNC_ACCOUNTS,
                        t({
                            en: "Want someone to cancel subscriptions for you",
                            es: "Quieres que alguien cancele tus suscripciones por ti",
                        }),
                        t({ en: "Want help negotiating your bills", es: "Quieres ayuda para negociar tus facturas" }),
                    ],
                },
                lead: t({
                    en: `${OUTLAYR_LEAD.en} ${RIVALS.rocketMoney.en}`,
                    es: `${OUTLAYR_LEAD.es} ${RIVALS.rocketMoney.es}`,
                }),
                meta: {
                    title: t({
                        en: "Rocket Money Alternative: Outlayr vs Rocket Money",
                        es: "Alternativa a Rocket Money: Outlayr vs Rocket Money",
                    }),
                },
                rival: "Rocket Money",
                rows: [
                    {
                        label: LABELS.price,
                        outlayr: OUTLAYR.price,
                        rival: t({
                            en: "Free plan. Premium is pay what you want, typically $7 to $14 a month. Premium+ is $15 a month",
                            es: "Plan gratis. Premium es paga lo que quieras, normalmente de $7 a $14 al mes. Premium+ cuesta $15 al mes",
                        }),
                    },
                    {
                        label: LABELS.entries,
                        outlayr: OUTLAYR.entries,
                        rival: t({
                            en: "Synced from linked accounts. Manual transactions are a Premium feature",
                            es: "Sincronizados desde cuentas vinculadas. Los movimientos a mano son una función Premium",
                        }),
                    },
                    {
                        label: LABELS.subscriptions,
                        outlayr: t({
                            en: "Log themselves on their day, with a monthly cost and a reminder before each charge",
                            es: "Se registran solas en su día, con un costo mensual y un aviso antes de cada cobro",
                        }),
                        rival: t({
                            en: "Found in linked accounts. Cancellation by its team is a Premium feature",
                            es: "Las encuentra en tus cuentas vinculadas. La cancelación por su equipo es una función Premium",
                        }),
                    },
                    {
                        label: LABELS.availability,
                        outlayr: t({
                            en: "175 App Store countries and regions, 165 currencies",
                            es: "175 países y regiones del App Store, 165 monedas",
                        }),
                        rival: t({
                            en: "The United States, with U.S. banks",
                            es: "Estados Unidos, con bancos de EE. UU.",
                        }),
                    },
                    {
                        label: LABELS.platforms,
                        outlayr: OUTLAYR.platforms,
                        rival: t({
                            en: "iPhone, Android. Web is a Premium feature",
                            es: "iPhone, Android. La web es una función Premium",
                        }),
                    },
                ],
                site: "rocketmoney.com",
                source: "https://www.rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost",
                summary: t(RIVALS.rocketMoney),
                title: t({
                    en: "Outlayr as a Rocket Money alternative.",
                    es: "Outlayr como alternativa a Rocket Money.",
                }),
            },
            ynab: {
                faq: [
                    {
                        answer: t({
                            en: "It is if you want to start free, spend in more than one currency, or would rather say or scan a purchase than type it. YNAB fits better if you want your bank to import transactions, or follow its give every dollar a job method.",
                            es: "Sí, si quieres empezar gratis, gastas en más de una moneda o prefieres dictar o escanear una compra en vez de escribirla. YNAB te conviene más si quieres que tu banco importe los movimientos, o si sigues su método de darle un trabajo a cada dólar.",
                        }),
                        question: t({
                            en: "Is Outlayr a good YNAB alternative?",
                            es: "¿Outlayr es una buena alternativa a YNAB?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes. You can log a purchase in any of 165 currencies, and totals convert at the rate from the day of each purchase. Each account keeps its own currency: the free plan holds accounts in one, Pro in any number. YNAB lets you pick one currency per spending plan.",
                            es: "Sí. Puedes registrar una compra en cualquiera de 165 monedas, y los totales se convierten con la tasa del día de cada compra. Cada cuenta tiene su propia moneda: el plan gratis permite cuentas en una, Pro en las que quieras. YNAB te deja elegir una moneda por plan de gastos.",
                        }),
                        question: t({
                            en: "Can Outlayr track more than one currency?",
                            es: "¿Outlayr puede llevar más de una moneda?",
                        }),
                    },
                    COST_FAQ,
                ],
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
                    en: `${OUTLAYR_LEAD.en} ${RIVALS.ynab.en}`,
                    es: `${OUTLAYR_LEAD.es} ${RIVALS.ynab.es}`,
                }),
                meta: {
                    title: t({
                        en: "YNAB Alternative: Outlayr vs YNAB (Price, Currencies, Platforms)",
                        es: "Alternativa a YNAB: Outlayr vs YNAB (precio, monedas y plataformas)",
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
                source: "https://www.ynab.com/pricing",
                summary: t(RIVALS.ynab),
                title: t({ en: "Outlayr as a YNAB alternative.", es: "Outlayr como alternativa a YNAB." }),
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
            "budget-planner": {
                facts: [
                    {
                        label: t({ en: "Limits", es: "Límites" }),
                        text: t({
                            en: "One per category, or one overall budget",
                            es: "Uno por categoría, o un presupuesto general",
                        }),
                    },
                    {
                        label: t({ en: "Periods", es: "Períodos" }),
                        text: t({ en: "A day, a week, a month, or a year", es: "Un día, una semana, un mes o un año" }),
                    },
                    {
                        label: t({ en: "Carry-over", es: "Acumular" }),
                        text: t({
                            en: "What you don't spend is added to the next period, and what you overspend is taken off it",
                            es: "Lo que no gastas se suma al siguiente período, y lo que te pasas se resta",
                        }),
                    },
                    {
                        label: t({ en: "Pace", es: "Ritmo" }),
                        text: t({
                            en: "How far short this pace ends, or the day the money ran out",
                            es: "Cuánto te va a faltar a este ritmo, o el día en que se acabó el dinero",
                        }),
                    },
                    {
                        label: t({ en: "Month start", es: "Inicio del mes" }),
                        text: t({
                            en: "Any day of the month, like payday",
                            es: "Cualquier día del mes, como el día de pago",
                        }),
                    },
                    {
                        label: t({ en: "Free plan", es: "Plan gratis" }),
                        text: t({
                            en: "2 category budgets. Unlimited with Pro",
                            es: "2 presupuestos por categoría. Sin límite con Pro",
                        }),
                    },
                ],
                faq: [
                    {
                        answer: t({
                            en: "Yes. Set a limit per category or one for the whole month, and Outlayr shows what is left and where your current pace ends as you log.",
                            es: "Sí. Pon un límite por categoría o uno para todo el mes, y Outlayr te muestra lo que queda y a dónde te lleva tu ritmo mientras registras.",
                        }),
                        question: t({
                            en: "Can Outlayr plan a monthly budget?",
                            es: "¿Outlayr sirve para armar un presupuesto mensual?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes. In Settings, under Time frames, pick the day your month starts. Budgets and insights then run from that day, so a month can start on payday.",
                            es: "Sí. En Configuración, en Períodos de tiempo, elige el día en que empieza tu mes. Los presupuestos y las estadísticas corren desde ese día, así que el mes puede empezar el día de pago.",
                        }),
                        question: t({
                            en: "Can my budget month start on payday?",
                            es: "¿Mi mes de presupuesto puede empezar el día de pago?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Turn on carry-over for a budget and what you don't spend is added to the next period. If you overspend, the difference is taken off the next one.",
                            es: "Activa la opción de acumular en un presupuesto y lo que no gastes se suma al siguiente período. Si te pasas, la diferencia se resta del siguiente.",
                        }),
                        question: t({
                            en: "What happens to money I don't spend?",
                            es: "¿Qué pasa con el dinero que no gasto?",
                        }),
                    },
                ],
                lead: t({
                    en: "Outlayr sets a budget per category or one for the whole month, carries over what you did not spend, and says where your current pace ends before the month does.",
                    es: "Outlayr pone un presupuesto por categoría o uno para todo el mes, acumula lo que no gastaste y te dice a dónde te lleva tu ritmo antes de que termine el mes.",
                }),
                meta: {
                    title: t({
                        en: "Budget Planner App: Limits, Carry-Over, and Pace · Outlayr",
                        es: "App de presupuesto mensual: límites y ritmo · Outlayr",
                    }),
                },
                plateAlt: BUDGETS_SCREEN_ALT,
                steps: [
                    {
                        text: t({
                            en: "On Budgets, pick a category or set one limit for the month. Categories without a budget show what you typically spend.",
                            es: "En Presupuestos, elige una categoría o pon un límite para el mes. Las categorías sin presupuesto muestran lo que gastas normalmente.",
                        }),
                        title: t({ en: "Set a limit", es: "Pon un límite" }),
                    },
                    {
                        text: t({
                            en: "Each entry updates what is left and the pace, whether you type, say, or scan it.",
                            es: "Cada registro actualiza lo que queda y el ritmo, ya sea que lo escribas, lo dictes o lo escanees.",
                        }),
                        title: t({ en: "Log as you spend", es: "Registra al gastar" }),
                    },
                    {
                        text: t({
                            en: "If this pace runs past the limit, Budgets says by how much, or the day the money ran out.",
                            es: "Si este ritmo pasa el límite, Presupuestos te dice por cuánto, o el día en que se acabó el dinero.",
                        }),
                        title: t({ en: "Read the pace", es: "Mira el ritmo" }),
                    },
                ],
                title: t({
                    en: "Plan a budget and see where this pace ends.",
                    es: "Arma tu presupuesto y ve a dónde te lleva este ritmo.",
                }),
            },
            "mint-alternative": {
                facts: [
                    {
                        label: t({ en: "Import", es: "Importa" }),
                        text: t({
                            en: "Your Mint CSV, with its date, description, amount, type, and category columns matched for you",
                            es: "Tu CSV de Mint, con las columnas de fecha, descripción, monto, tipo y categoría asignadas solas",
                        }),
                    },
                    {
                        label: t({ en: "Categories", es: "Categorías" }),
                        text: t({
                            en: "Mint's category names are matched to yours by AI matching",
                            es: "Los nombres de categoría de Mint se asignan a los tuyos con la asignación con IA",
                        }),
                    },
                    {
                        label: t({ en: "Duplicates", es: "Duplicados" }),
                        text: t({
                            en: "Rows that look already imported are flagged before you save",
                            es: "Las filas que parecen ya importadas se marcan antes de guardar",
                        }),
                    },
                    {
                        label: t({ en: "Budgets", es: "Presupuestos" }),
                        text: OUTLAYR.budgets,
                    },
                    {
                        label: t({ en: "After", es: "Después" }),
                        text: t({
                            en: "Log new purchases by sentence, voice, or receipt",
                            es: "Registra compras nuevas con una oración, con tu voz o con un recibo",
                        }),
                    },
                    {
                        label: t({ en: "Needs", es: "Requiere" }),
                        text: t({
                            en: "Outlayr Pro and an account. Up to 5,000 rows a file",
                            es: "Outlayr Pro y una cuenta. Hasta 5,000 filas por archivo",
                        }),
                    },
                ],
                faq: [
                    {
                        answer: t({
                            en: "Intuit says Mint has been reimagined on Credit Karma. If you want a budget app instead, Outlayr imports the CSV you exported from Mint.",
                            es: "Intuit dice que Mint ahora vive en Credit Karma. Si prefieres una app de presupuesto, Outlayr importa el CSV que exportaste de Mint.",
                        }),
                        question: t({ en: "What replaced Mint?", es: "¿Qué reemplazó a Mint?" }),
                    },
                    {
                        answer: t({
                            en: "Yes, with Outlayr Pro, if you exported a CSV from Mint. Outlayr reads its date, description, amount, type, and category columns, matches Mint's category names to yours with AI, and flags rows that look already imported before you save. A file can hold up to 5,000 rows, so split a longer export by year.",
                            es: "Sí, con Outlayr Pro, si exportaste un CSV de Mint. Outlayr lee sus columnas de fecha, descripción, monto, tipo y categoría, asigna los nombres de categoría de Mint a los tuyos con IA y marca las filas que parecen ya importadas antes de guardar. Un archivo puede tener hasta 5,000 filas, así que divide una exportación más larga por año.",
                        }),
                        question: t({
                            en: "Can I import my Mint data into Outlayr?",
                            es: "¿Puedo importar mis datos de Mint a Outlayr?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Logging, budgets, goals, and subscriptions are free. Importing a Mint file needs Outlayr Pro, because Mint's category names are matched to yours with AI. Pro is billed monthly or yearly, or bought once.",
                            es: "Registrar, los presupuestos, las metas y las suscripciones son gratis. Importar un archivo de Mint requiere Outlayr Pro, porque los nombres de categoría de Mint se asignan a los tuyos con IA. Pro se paga al mes, al año o en un solo pago.",
                        }),
                        question: t({
                            en: "Is Outlayr free like Mint was?",
                            es: "¿Outlayr es gratis como lo era Mint?",
                        }),
                    },
                ],
                lead: t({
                    en: "Mint has been reimagined on Credit Karma, in Intuit's words. Outlayr imports the CSV you exported from Mint, then keeps your budgets and spending going on iPhone.",
                    es: "Mint ahora vive en Credit Karma, según Intuit. Outlayr importa el CSV que exportaste de Mint y sigue con tus presupuestos y tus gastos en iPhone.",
                }),
                meta: {
                    title: t({
                        en: "Mint Alternative: Import Your Mint CSV · Outlayr",
                        es: "Alternativa a Mint: importa tu CSV de Mint · Outlayr",
                    }),
                },
                plateAlt: t({
                    en: "Outlayr Log with a $42.00 Costco purchase at the top and the entries from earlier days below.",
                    es: "Registro de Outlayr con una compra de $42.00 en Costco arriba y los registros de días anteriores abajo.",
                }),
                steps: [
                    {
                        text: t({
                            en: "Save the CSV you exported from Mint to Files or iCloud Drive on your iPhone. Split it by year if it has more than 5,000 rows.",
                            es: "Guarda el CSV que exportaste de Mint en Archivos o iCloud Drive en tu iPhone. Divídelo por año si tiene más de 5,000 filas.",
                        }),
                        title: t({ en: "Find your Mint CSV", es: "Busca tu CSV de Mint" }),
                    },
                    {
                        text: t({
                            en: "In Settings, tap Import data, then CSV file, and pick the file.",
                            es: "En Configuración, toca Importar datos, luego Archivo CSV, y elige el archivo.",
                        }),
                        title: t({ en: "Import it", es: "Impórtalo" }),
                    },
                    {
                        text: t({
                            en: "Check the rows, leave out any marked as already imported, and tap Import.",
                            es: "Revisa las filas, deja fuera las que aparecen como ya importadas y toca Importar.",
                        }),
                        title: t({ en: "Review and save", es: "Revisa y guarda" }),
                    },
                ],
                title: t({
                    en: "A Mint alternative that takes your Mint CSV.",
                    es: "Una alternativa a Mint que importa tu CSV de Mint.",
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
            "subscription-tracker": {
                facts: [
                    {
                        label: t({ en: "Repeats", es: "Se repite" }),
                        text: t({
                            en: "Daily, weekly, monthly, yearly, or a custom schedule",
                            es: "Diario, semanal, mensual, anual o un calendario personalizado",
                        }),
                    },
                    {
                        label: t({ en: "Logged", es: "Registra" }),
                        text: t({
                            en: "Each charge lands on the Log on its day, in its account and category",
                            es: "Cada cobro llega al Registro en su día, en su cuenta y su categoría",
                        }),
                    },
                    {
                        label: t({ en: "Per month", es: "Al mes" }),
                        text: t({
                            en: "What your subscriptions and bills cost, with yearly plans spread across the months",
                            es: "Lo que cuestan tus suscripciones y pagos fijos, con los planes anuales repartidos entre los meses",
                        }),
                    },
                    {
                        label: t({ en: "Reminders", es: "Avisos" }),
                        text: t({
                            en: "On the day, or 1, 2, 3, or 7 days before each charge",
                            es: "El mismo día, o 1, 2, 3 o 7 días antes de cada cobro",
                        }),
                    },
                    {
                        label: t({ en: "Bills and pay", es: "Pagos y sueldo" }),
                        text: t({
                            en: "Rent, utilities, and paychecks repeat the same way",
                            es: "La renta, los servicios y el sueldo se repiten igual",
                        }),
                    },
                    {
                        label: t({ en: "Currencies", es: "Monedas" }),
                        text: t({
                            en: "Each subscription in the currency it bills in",
                            es: "Cada suscripción en la moneda en que te cobra",
                        }),
                    },
                    {
                        label: t({ en: "Free plan", es: "Plan gratis" }),
                        text: t({
                            en: "Subscriptions, reminders, and Upcoming are free",
                            es: "Las suscripciones, los avisos y Próximos son gratis",
                        }),
                    },
                ],
                faq: [
                    {
                        answer: t({
                            en: "Yes. Add a subscription once with how often it repeats, and Outlayr logs each charge on its day. Upcoming lists the next charges and what they cost per month.",
                            es: "Sí. Agrega una suscripción una vez con la frecuencia con que se repite, y Outlayr registra cada cobro en su día. Próximos muestra los próximos cobros y cuánto cuestan al mes.",
                        }),
                        question: t({
                            en: "Can Outlayr track my subscriptions?",
                            es: "¿Outlayr puede controlar mis suscripciones?",
                        }),
                    },
                    {
                        answer: t({
                            en: "No. Outlayr shows what each subscription costs and when it charges next, and can remind you before the charge, so you can cancel with the service in time.",
                            es: "No. Outlayr te muestra cuánto cuesta cada suscripción y cuándo vuelve a cobrar, y puede avisarte antes del cobro, para que la canceles a tiempo con el servicio.",
                        }),
                        question: t({
                            en: "Does Outlayr cancel subscriptions for me?",
                            es: "¿Outlayr cancela suscripciones por mí?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Each subscription chooses its own reminder: on the day, or 1, 2, 3, or 7 days before. One switch in Settings, under Notifications, silences all of them.",
                            es: "Cada suscripción elige su aviso: el mismo día, o 1, 2, 3 o 7 días antes. Un interruptor en Configuración, en Notificaciones, los silencia todos.",
                        }),
                        question: t({
                            en: "When does Outlayr remind me about a charge?",
                            es: "¿Cuándo me avisa Outlayr de un cobro?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes. Anything that repeats works the same way: rent, utilities, phone plans, and paychecks log themselves on their day, with the same reminders.",
                            es: "Sí. Todo lo que se repite funciona igual: la renta, los servicios, el plan del celular y el sueldo se registran solos en su día, con los mismos avisos.",
                        }),
                        question: t({
                            en: "Can it track bills and paychecks too?",
                            es: "¿También sirve para pagos fijos y el sueldo?",
                        }),
                    },
                    {
                        answer: t({
                            en: "Yes. Recurring entries, reminders, and Upcoming are part of the free plan.",
                            es: "Sí. Los registros recurrentes, los avisos y Próximos son parte del plan gratis.",
                        }),
                        question: t({
                            en: "Is the subscription tracker free?",
                            es: "¿El control de suscripciones es gratis?",
                        }),
                    },
                ],
                lead: t({
                    en: "Outlayr logs each subscription on the day it charges, adds up what your subscriptions and bills cost per month, and can remind you before the next charge.",
                    es: "Outlayr registra cada suscripción el día que te cobra, suma cuánto te cuestan al mes tus suscripciones y pagos fijos, y puede avisarte antes del siguiente cobro.",
                }),
                meta: {
                    title: t({
                        en: "Subscription Tracker: Monthly Cost and Reminders · Outlayr",
                        es: "Control de suscripciones: costo mensual y avisos · Outlayr",
                    }),
                },
                steps: [
                    {
                        text: t({
                            en: "Type, say, or scan the first charge, then tap repeat and pick monthly, yearly, or a custom schedule.",
                            es: "Escribe, dicta o escanea el primer cobro, luego toca repetir y elige mensual, anual o un calendario personalizado.",
                        }),
                        title: t({ en: "Log it once", es: "Regístrala una vez" }),
                    },
                    {
                        text: t({
                            en: "Under Remind Me, pick the day of the charge or up to a week before.",
                            es: "En Recordarme, elige el día del cobro o hasta una semana antes.",
                        }),
                        title: t({ en: "Choose a reminder", es: "Elige un aviso" }),
                    },
                    {
                        text: t({
                            en: "Upcoming, at the top of the Log and under Upcoming entries in Settings, lists the next charges and what they cost per month.",
                            es: "Próximos, arriba del Registro y en Próximos registros dentro de Configuración, muestra los próximos cobros y cuánto cuestan al mes.",
                        }),
                        title: t({ en: "Read the monthly cost", es: "Mira el costo mensual" }),
                    },
                ],
                title: t({
                    en: "Track every subscription and what it costs a month.",
                    es: "Controla tus suscripciones y lo que te cuestan al mes.",
                }),
            },
        },
        hubs: {
            compare: {
                lead: t({
                    en: `${OUTLAYR_LEAD.en} Each page sets price, how entries get in, and platforms side by side, checked at the other app's own site.`,
                    es: `${OUTLAYR_LEAD.es} Cada página pone lado a lado el precio, cómo registras y las plataformas, revisados en el sitio de la otra app.`,
                }),
                meta: {
                    title: t({
                        en: "Budget App Comparisons: Outlayr vs YNAB, Monarch, and More",
                        es: "Comparativas de apps de presupuesto: Outlayr vs YNAB, Monarch y más",
                    }),
                },
                title: t({ en: "Outlayr next to the apps you know.", es: "Outlayr junto a las apps que conoces." }),
            },
            guides: {
                lead: t({
                    en: "How each part of Outlayr works, step by step, with what the free plan includes.",
                    es: "Cómo funciona cada parte de Outlayr, paso a paso, con lo que incluye el plan gratis.",
                }),
                meta: {
                    title: t({
                        en: "Expense Tracking Guides · Outlayr",
                        es: "Guías para controlar tus gastos · Outlayr",
                    }),
                },
                title: t({ en: "How Outlayr does it.", es: "Cómo lo hace Outlayr." }),
            },
        },
        labels: {
            feature: t({ en: "Feature", es: "Función" }),
            fit: t({ en: "Which one fits", es: "Cuál te conviene" }),
            fitHeading: insert(t({ en: "{{name}}, if you", es: "{{name}}, si" })),
            questions: t({ en: "Questions", es: "Preguntas" }),
            checked: insert(t({ en: ", checked {{date}}.", es: ", revisados el {{date}}." })),
            source: insert(t({ en: "{{name}} details from", es: "Datos de {{name}} tomados de" })),
            steps: t({ en: "How it works", es: "Cómo funciona" }),
        },
    },
    key: "answers",
} satisfies Dictionary;

export default answers;
