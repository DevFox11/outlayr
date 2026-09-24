import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const home = {
    content: {
        closingTitle: t({ en: "Log the next thing you buy.", es: "Registra lo próximo que compres." }),
        extras: [
            {
                label: t({ en: "Subscriptions", es: "Suscripciones" }),
                text: t({
                    en: "Rent, bills, and streaming log themselves on their day. See the monthly total and set a reminder before each charge.",
                    es: "La renta, los servicios y el streaming se registran solos en su día. Mira el total del mes y pon un recordatorio antes de cada cobro.",
                }),
            },
            {
                label: t({ en: "Split", es: "Dividir" }),
                text: t({
                    en: "Divide one purchase across several categories.",
                    es: "Reparte una compra entre varias categorías.",
                }),
            },
            {
                label: t({ en: "Currencies", es: "Monedas" }),
                text: t({
                    en: "Log in any of 165 currencies and read totals in yours, at the rate from the day it happened.",
                    es: "Registra en cualquiera de 165 monedas y mira los totales en la tuya, con la tasa del día en que ocurrió.",
                }),
            },
            {
                label: t({ en: "Widgets", es: "Widgets" }),
                text: t({
                    en: "Four for the iPhone Home Screen and Lock Screen: today’s spending, budget left, recent entries, insights.",
                    es: "Cuatro para la pantalla de inicio y la pantalla bloqueada del iPhone: el gasto de hoy, el presupuesto disponible, los registros recientes y tus estadísticas.",
                }),
            },
            {
                label: t({ en: "Apple Pay", es: "Apple Pay" }),
                text: t({
                    en: "On iPhone, pay with Apple Pay and a Shortcuts automation logs the purchase.",
                    es: "En iPhone, paga con Apple Pay y una automatización de Atajos registra la compra.",
                }),
            },
            {
                label: t({ en: "Search", es: "Buscar" }),
                text: t({
                    en: "Find any entry by note, category, or amount. On iPhone, entries show up in Spotlight too.",
                    es: "Encuentra cualquier registro por nota, categoría o monto. En iPhone, los registros también aparecen en Spotlight.",
                }),
            },
            {
                label: t({ en: "Offline", es: "Sin conexión" }),
                text: t({
                    en: "Entries save on the phone first, so logging works with no signal.",
                    es: "Los registros se guardan primero en el celular, así que puedes registrar sin señal.",
                }),
            },
            {
                label: t({ en: "Export", es: "Exportar" }),
                text: t({
                    en: "A CSV, or a full archive you can restore from.",
                    es: "Un CSV o un archivo completo desde el que puedes restaurar.",
                }),
            },
            {
                label: t({ en: "Lock", es: "Bloqueo" }),
                text: t({
                    en: "Face ID or Touch ID to open on iPhone. The app switcher never shows your ledger.",
                    es: "Face ID o Touch ID para abrirla en iPhone. El selector de apps nunca muestra tu registro.",
                }),
            },
            {
                label: t({ en: "Appearance", es: "Apariencia" }),
                text: t({
                    en: "Light and dark, five accent colors, five app icons.",
                    es: "Claro y oscuro, cinco colores de acento y cinco íconos de la app.",
                }),
            },
        ],
        extrasTitle: t({ en: "Also in the app.", es: "También en la app." }),
        facts: [
            {
                label: t({ en: "Available", es: "Disponible" }),
                value: t({ en: "iPhone · Android soon", es: "iPhone · Android pronto" }),
            },
            {
                label: t({ en: "Languages", es: "Idiomas" }),
                value: "English, Español",
            },
            {
                label: t({ en: "Price", es: "Precio" }),
                value: t({ en: "Free, Pro optional", es: "Gratis, Pro opcional" }),
            },
        ],
        faq: [
            {
                answer: t({
                    en: "Outlayr is an expense tracker and budget app. You log a purchase by typing one sentence, saying it, or scanning the receipt. Budgets, savings goals, subscriptions, and insights update as you log, in any of 165 currencies, in English or Spanish.",
                    es: "Outlayr es una app para controlar tus gastos y tu presupuesto. Registras una compra escribiendo una oración, dictándola o escaneando el recibo. Los presupuestos, las metas de ahorro, las suscripciones y las estadísticas se actualizan a medida que registras, en cualquiera de 165 monedas, en inglés o en español.",
                }),
                question: t({ en: "What is Outlayr?", es: "¿Qué es Outlayr?" }),
            },
            {
                answer: t({
                    en: "Yes. Logging, budgets, goals, insights, subscriptions, and widgets are free. The free plan includes 20 voice or receipt captures every 30 days, 2 accounts, and 2 category budgets. Outlayr Pro raises those limits and adds sync across devices and receipt photo backup.",
                    es: "Sí. Registrar gastos es gratis, igual que los presupuestos, las metas, las estadísticas, las suscripciones y los widgets. El plan gratis incluye 20 capturas de voz o de recibos cada 30 días, 2 cuentas y 2 presupuestos por categoría. Outlayr Pro sube esos límites y agrega la sincronización entre dispositivos y el respaldo de las fotos de tus recibos.",
                }),
                question: t({ en: "Is Outlayr free?", es: "¿Outlayr es gratis?" }),
            },
            {
                answer: t({
                    en: "Not yet. Outlayr is available on iPhone with iOS 18 or later, and an Android version is coming soon.",
                    es: "Todavía no. Outlayr está disponible en iPhone con iOS 18 o posterior, y pronto llegará una versión para Android.",
                }),
                question: t({ en: "Is Outlayr on Android?", es: "¿Outlayr está en Android?" }),
            },
            {
                answer: t({
                    en: "Take a photo of the receipt or pick one from your library. Outlayr reads the store, the date, the total, and every line, then fills in the entry for you to save. Scanning needs an account, and each scan counts as one capture.",
                    es: "Toma una foto del recibo o elige una de tu galería. Outlayr lee la tienda, la fecha, el total y cada línea, y llena el registro para que lo guardes. Para escanear necesitas una cuenta, y cada escaneo equivale a una captura.",
                }),
                question: t({ en: "How does receipt scanning work?", es: "¿Cómo funciona el escaneo de recibos?" }),
            },
            {
                answer: t({
                    en: "Yes. Outlayr supports 165 currencies. You can log a purchase in any of them, and totals convert to your main currency at the rate from the day it happened. Each account keeps its own currency: the free plan includes one, Pro allows more.",
                    es: "Sí. Outlayr admite 165 monedas. Puedes registrar una compra en cualquiera de ellas, y los totales se convierten a tu moneda principal con la tasa del día de la compra. Cada cuenta tiene su propia moneda: el plan gratis incluye una y Pro permite más.",
                }),
                question: t({
                    en: "Can I track expenses in different currencies?",
                    es: "¿Puedo registrar gastos en distintas monedas?",
                }),
            },
            {
                answer: t({
                    en: "Yes. Entries save on your phone first, so typing an entry works with no signal. Voice entry and receipt scanning need a connection. With Pro, sync sends your entries to your other devices once you are back online.",
                    es: "Sí. Los registros se guardan primero en tu celular, así que puedes escribir uno sin señal. Para dictar y escanear recibos necesitas conexión. Con Pro, la sincronización envía tus registros a tus otros dispositivos cuando vuelves a tener conexión.",
                }),
                question: t({ en: "Does Outlayr work offline?", es: "¿Outlayr funciona sin conexión?" }),
            },
            {
                answer: t({
                    en: "Yes. Export a CSV from your bank or another app and import it. Duplicates are skipped, and merchants Outlayr already knows are matched to your categories on your phone. With Pro, the rest can go to AI matching.",
                    es: "Sí. Exporta un CSV desde tu banco u otra app e impórtalo. Los duplicados se omiten, y los comercios que Outlayr ya conoce se asignan a tus categorías en tu celular. Con Pro, el resto se puede asociar con IA.",
                }),
                question: t({ en: "Can I import a CSV from my bank?", es: "¿Puedo importar un CSV de mi banco?" }),
            },
            {
                answer: t({
                    en: "Your ledger is stored on your phone. It reaches our servers only if you sign in and turn on sync, or use a feature that needs them, like receipt scanning. Outlayr has no ads and no analytics, and your data is never sold.",
                    es: "Tu registro se guarda en tu celular. Solo llega a nuestros servidores si inicias sesión y activas la sincronización, o si usas una función que los necesite, como el escaneo de recibos. Outlayr no tiene anuncios ni analíticas, y tus datos nunca se venden.",
                }),
                question: t({ en: "Who can see my financial data?", es: "¿Quién puede ver mis datos financieros?" }),
            },
        ],
        faqTitle: t({ en: "Questions, answered.", es: "Preguntas y respuestas." }),
        hero: {
            lead: t({
                en: "Outlayr is an expense tracker and budget app. Type a purchase as one sentence, say it, or scan the receipt. Subscriptions and paychecks log themselves on the day they land.",
                es: "Outlayr es una app para controlar tus gastos y tu presupuesto. Escribe una compra en una oración, díctala o escanea el recibo. Las suscripciones y los sueldos se registran solos el día que llegan.",
            }),
            pauseVideo: t({ en: "Pause", es: "Pausar" }),
            playVideo: t({ en: "Play", es: "Reproducir" }),
            secondary: t({ en: "See what’s free", es: "Mira qué es gratis" }),
            title: t({ en: "Track every expense in one sentence.", es: "Registra cada gasto en una oración." }),
            videoCaption: t({ en: "Logging $42.00 at Costco", es: "Registrar $42.00 en Costco" }),
            videoLabel: t({
                en: "Logging a $42.00 grocery purchase at Costco in Outlayr, from the add menu to the Log.",
                es: "Cómo se registra en Outlayr una compra de súper de $42.00 en Costco, desde el menú para agregar hasta el Registro.",
            }),
        },
        meta: {
            description: t({
                en: "Outlayr is an expense tracker and budget app. Log a purchase in one sentence, by voice, or by scanning the receipt. Free on iPhone, Android soon.",
                es: "Outlayr es una app para controlar tus gastos y tu presupuesto. Registra una compra en una oración, con tu voz o escaneando el recibo. Gratis en iPhone, pronto en Android.",
            }),
            title: t({
                en: "Outlayr: Expense Tracker, Budget App & Receipt Scanner",
                es: "Outlayr: control de gastos, presupuestos y escáner de recibos",
            }),
        },
        plans: [
            { free: "20", label: t({ en: "Captures every 30 days", es: "Capturas cada 30 días" }), pro: "500" },
            {
                free: "2",
                label: t({ en: "Accounts", es: "Cuentas" }),
                pro: t({ en: "unlimited", es: "sin límite" }),
            },
            {
                free: "2",
                label: t({ en: "Category budgets", es: "Presupuestos por categoría" }),
                pro: t({ en: "unlimited", es: "sin límite" }),
            },
            {
                free: "1",
                label: t({ en: "Account currencies", es: "Monedas de cuentas" }),
                pro: t({ en: "unlimited", es: "sin límite" }),
            },
            {
                free: t({ en: "off", es: "no" }),
                label: t({ en: "Sync across devices", es: "Sincronizar dispositivos" }),
                pro: t({ en: "on", es: "sí" }),
            },
            {
                free: t({ en: "off", es: "no" }),
                label: t({ en: "Receipt photo backup", es: "Respaldo de fotos" }),
                pro: t({ en: "on", es: "sí" }),
            },
            {
                free: t({ en: "off", es: "no" }),
                label: t({ en: "AI matching on import", es: "Coincidencia con IA al importar" }),
                pro: t({ en: "on", es: "sí" }),
            },
            {
                free: t({ en: "off", es: "no" }),
                label: t({ en: "Web merchant lookup", es: "Búsqueda web de comercios" }),
                pro: t({ en: "on", es: "sí" }),
            },
            { free: "1", label: t({ en: "App icons", es: "Íconos de la app" }), pro: "5" },
        ],
        plansCopy: {
            feature: t({ en: "Feature", es: "Función" }),
            footnote: t({
                en: "A capture is one voice entry or one receipt scan, and needs you signed in. Pro is billed monthly or yearly, or bought once, at the price your app store shows in your country.",
                es: "Una captura es un registro por voz o un escaneo de recibo, y requiere que hayas iniciado sesión. Pro se cobra al mes o al año, o se compra una sola vez, al precio que muestra tu tienda de apps en tu país.",
            }),
            free: t({ en: "Free", es: "Gratis" }),
            lead: t({
                en: "The tracker is free. Pro lifts the limits and adds sync.",
                es: "La app es gratis. Pro quita los límites y agrega la sincronización.",
            }),
            pro: "Pro",
            title: t({ en: "Free to start.", es: "Gratis para empezar." }),
        },
        tour: [
            {
                alt: t({
                    en: "Outlayr Budgets screen: $1,018.59 left this month, a spending curve projected past the limit, and the note that on this pace the period ends $319 short.",
                    es: "Pantalla de presupuestos de Outlayr: $1,018.59 disponibles este mes, una curva de gasto que pasa el límite y la nota de que, a este ritmo, te faltarán $319 al final del período.",
                }),
                body: t({
                    en: "Set a limit per category or one for the whole month, and carry over what you didn’t spend. The chart shows where this pace ends, not just what’s left.",
                    es: "Pon un límite por categoría o uno para todo el mes, y acumula lo que no gastaste. El gráfico muestra a dónde te lleva este ritmo, no solo lo que queda.",
                }),
                notes: [
                    { text: t({ en: "What’s left this period.", es: "Lo que queda en este período." }), y: 22.5 },
                    { text: t({ en: "Where this pace lands.", es: "A dónde te lleva este ritmo." }), y: 44 },
                    { text: t({ en: "The same read, in plain words.", es: "Lo mismo, en palabras simples." }), y: 58 },
                ],
                src: "/screens/04.webp",
                title: t({ en: "Spot the overspend early.", es: "Descubre a tiempo si te vas a pasar." }),
            },
            {
                alt: t({
                    en: "Outlayr Insights for 6 to 12 September: $597.95 spent, 74% less than the week before, a bar for each day, and the categories that moved most.",
                    es: "Estadísticas de Outlayr del 6 al 12 de septiembre: $597.95 gastados, 74% menos que la semana anterior, una barra por día y las categorías que más cambiaron.",
                }),
                body: t({
                    en: "Spending by day and by category, income against spending, and net worth over time. Start the month on payday and every chart follows.",
                    es: "Gastos por día y por categoría, ingresos frente a gastos y tu patrimonio a lo largo del tiempo. Empieza el mes el día de pago y todos los gráficos se ajustan.",
                }),
                notes: [
                    {
                        text: t({
                            en: "Change against the week before.",
                            es: "El cambio frente a la semana anterior.",
                        }),
                        y: 23.4,
                    },
                    {
                        text: t({ en: "The categories that moved most.", es: "Las categorías que más cambiaron." }),
                        y: 61.8,
                    },
                    {
                        text: t({
                            en: "Where the week went, by category.",
                            es: "En qué se fue la semana, por categoría.",
                        }),
                        y: 80.6,
                    },
                ],
                src: "/screens/05.webp",
                title: t({ en: "See what moved since last week.", es: "Mira qué cambió desde la semana pasada." }),
            },
            {
                alt: t({
                    en: "Outlayr Accounts screen listing eight accounts, including Banesco in bolívares and an Apple Card with a negative balance, above a Transfer button.",
                    es: "Pantalla de cuentas de Outlayr con ocho cuentas, entre ellas Banesco en bolívares y una Apple Card con saldo negativo, arriba de un botón para transferir.",
                }),
                body: t({
                    en: "Cash, cards, savings, and debts side by side. A transfer moves money between them without counting as spending.",
                    es: "Efectivo, tarjetas, ahorros y deudas, todo junto. Una transferencia mueve dinero entre tus cuentas sin contar como gasto.",
                }),
                notes: [
                    {
                        text: t({
                            en: "Balances stay in the currency they hold.",
                            es: "Cada saldo se queda en su propia moneda.",
                        }),
                        y: 40.5,
                    },
                    {
                        text: t({
                            en: "Cards and debts carry what you owe.",
                            es: "Las tarjetas y las deudas muestran lo que debes.",
                        }),
                        y: 54.4,
                    },
                    { text: t({ en: "Move money between accounts.", es: "Mueve dinero entre cuentas." }), y: 78.6 },
                ],
                src: "/screens/06.webp",
                title: t({ en: "Every account, every currency.", es: "Cada cuenta, cada moneda." }),
            },
            {
                alt: t({
                    en: "Outlayr savings goals: Japan in April and an emergency fund marked ahead, a new MacBook marked behind, and $8,786 to go in total.",
                    es: "Metas de ahorro en Outlayr: Japón en abril y un fondo de emergencia marcados como adelantados, una MacBook nueva marcada como atrasada y $8,786 por juntar en total.",
                }),
                body: t({
                    en: "Pick a target and a date. Outlayr shows what to save each month to get there, and whether you’re ahead or behind.",
                    es: "Elige un objetivo y una fecha. Outlayr te muestra cuánto ahorrar cada mes para llegar, y si vas adelantado o atrasado.",
                }),
                notes: [
                    {
                        text: t({
                            en: "Left to save across every goal.",
                            es: "Lo que falta por ahorrar en todas tus metas.",
                        }),
                        y: 41,
                    },
                    {
                        text: t({
                            en: "The monthly amount that gets you there on time.",
                            es: "Lo que tienes que ahorrar al mes para llegar a tiempo.",
                        }),
                        y: 58.8,
                    },
                    {
                        text: t({ en: "Behind pace shows in red.", es: "Si vas atrasado, se ve en rojo." }),
                        y: 78.5,
                    },
                ],
                src: "/screens/08.webp",
                title: t({ en: "Goals with a date on them.", es: "Metas con fecha." }),
            },
        ],
    },
    key: "home",
} satisfies Dictionary;

export default home;
