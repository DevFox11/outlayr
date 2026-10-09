import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const about = {
    content: {
        allComparisons: t({ en: "All comparisons", es: "Todas las comparativas" }),
        allGuides: t({ en: "All guides", es: "Todas las guías" }),
        appIcon: t({ en: "App icon", es: "Ícono de la app" }),
        entity: t({
            en: "Outlayr is an expense tracker, budget app, and subscription tracker for iPhone, made by danestves LLC.",
            es: "Outlayr es una app para controlar tus gastos, tu presupuesto y tus suscripciones en iPhone, hecha por danestves LLC.",
        }),
        facts: [
            {
                label: t({ en: "Maker", es: "Empresa" }),
                text: t({
                    en: "danestves LLC, a Delaware limited liability company. 651 N Broad St, Suite 201, Middletown, DE 19709, USA.",
                    es: "danestves LLC, una sociedad de responsabilidad limitada de Delaware. 651 N Broad St, Suite 201, Middletown, DE 19709, EE. UU.",
                }),
            },
            {
                label: t({ en: "Platforms", es: "Plataformas" }),
                text: t({
                    en: "iPhone with iOS 18 or later. Android is coming soon.",
                    es: "iPhone con iOS 18 o posterior. Pronto llegará una versión para Android.",
                }),
            },
            {
                label: t({ en: "Languages", es: "Idiomas" }),
                text: t({ en: "English and Latin American Spanish.", es: "Inglés y español de Latinoamérica." }),
            },
            {
                label: t({ en: "Logging", es: "Registro" }),
                text: t({
                    en: "Type a purchase as one sentence, say it, scan the receipt, or import a CSV. On iPhone, a Shortcuts automation can log each Apple Pay purchase.",
                    es: "Escribe una compra en una oración, díctala, escanea el recibo o importa un CSV. En iPhone, una automatización de Atajos puede registrar cada compra con Apple Pay.",
                }),
            },
            {
                label: t({ en: "Currencies", es: "Monedas" }),
                text: t({
                    en: "165 currencies. Totals convert to your main currency at the rate from the day of each purchase.",
                    es: "165 monedas. Los totales se convierten a tu moneda principal con la tasa del día de cada compra.",
                }),
            },
            {
                label: t({ en: "Account", es: "Cuenta" }),
                text: t({
                    en: "Optional. Signing in with Apple or Google is needed for sync, voice entry, receipt scanning, and to buy Pro.",
                    es: "Opcional. Necesitas iniciar sesión con Apple o Google para sincronizar, dictar registros, escanear recibos y comprar Pro.",
                }),
            },
            {
                label: t({ en: "Free plan", es: "Plan gratis" }),
                text: t({
                    en: "Logging, budgets, goals, insights, subscriptions, and widgets, with 20 voice or receipt captures every 30 days, 2 accounts, 2 category budgets, 1 account currency, and 1 app icon.",
                    es: "Registros, presupuestos, metas, estadísticas, suscripciones y widgets, con 20 capturas de voz o de recibos cada 30 días, 2 cuentas, 2 presupuestos por categoría, 1 moneda para tus cuentas y 1 ícono de la app.",
                }),
            },
            {
                label: "Outlayr Pro",
                text: t({
                    en: "500 captures every 30 days, unlimited accounts, category budgets, and account currencies, sync across devices, receipt photo backup, AI matching on CSV import, web merchant lookup, and 5 app icons.",
                    es: "500 capturas cada 30 días, cuentas, presupuestos por categoría y monedas sin límite, sincronización entre dispositivos, respaldo de las fotos de tus recibos, asignación con IA al importar un CSV, búsqueda web de comercios y 5 íconos de la app.",
                }),
            },
            {
                label: t({ en: "Price", es: "Precio" }),
                text: t({
                    en: "Pro is billed monthly or yearly, or bought once, at prices set per country in the App Store. There are no ads on any plan.",
                    es: "Pro se paga al mes, al año o en un solo pago, con precios por país en el App Store. No hay anuncios en ningún plan.",
                }),
            },
            {
                label: t({ en: "Your data", es: "Tus datos" }),
                text: t({
                    en: "Your ledger is stored on your phone. Without an account, your entries, amounts, and notes never leave it. With Pro, sync keeps a copy on our servers until you delete your account. Voice entries, receipt scans, and merchant suggestions are processed by xAI, and recordings and scanned photos are not stored. Your data is never sold.",
                    es: "Tu registro se guarda en tu celular. Sin una cuenta, tus registros, montos y notas nunca salen de él. Con Pro, la sincronización guarda una copia en nuestros servidores hasta que elimines tu cuenta. Las entradas por voz, los escaneos de recibos y las sugerencias de comercios los procesa xAI, y no guardamos las grabaciones ni las fotos escaneadas. Tus datos nunca se venden.",
                }),
            },
            {
                label: t({ en: "Does not", es: "No hace" }),
                text: t({
                    en: "Outlayr does not cancel subscriptions or negotiate bills for you.",
                    es: "Outlayr no cancela suscripciones ni negocia tus facturas por ti.",
                }),
            },
        ],
        meta: {
            description: t({
                en: "Outlayr is an expense tracker, budget app, and subscription tracker for iPhone, made by danestves LLC. Platforms, languages, plans, free limits, and where your data lives.",
                es: "Outlayr es una app para controlar tus gastos, tu presupuesto y tus suscripciones en iPhone, hecha por danestves LLC. Plataformas, idiomas, planes, límites y dónde están tus datos.",
            }),
            title: t({
                en: "About Outlayr: the expense tracker by danestves LLC",
                es: "Acerca de Outlayr: la app de gastos de danestves LLC",
            }),
        },
        press: t({ en: "Press", es: "Prensa" }),
        title: t({ en: "Outlayr at a glance", es: "Outlayr de un vistazo" }),
    },
    key: "about",
} satisfies Dictionary;

export default about;
