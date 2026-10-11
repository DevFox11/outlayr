import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const appUi = {
    content: {
        accounts: {
            cash: t({ en: "Cash", es: "Efectivo" }),
            label: t({
                en: "Eight accounts: Chase, Ally Savings, Zinli, PayPal, Apple Card, Amex Gold, and cash in dollars, Banesco in bolívares.",
                es: "Ocho cuentas: Chase, Ally Savings, Zinli, PayPal, Apple Card, Amex Gold y efectivo en dólares, Banesco en bolívares.",
            }),
            transfer: t({ en: "Transfer", es: "Transferencia" }),
        },
        budget: {
            aDay: t({ en: "A day", es: "Al día" }),
            daysLeft: t({ en: "18d left", es: "quedan 18d" }),
            label: t({
                en: "Budgets: $1,018.59 left this month of a $3,900 limit, $2,881 spent, $57 a day. On this pace the month ends $319 short.",
                es: "Presupuestos: quedan $1,018.59 este mes de un límite de $3,900, $2,881 gastados, $57 al día. A este ritmo, el mes termina $319 por debajo.",
            }),
            left: t({ en: "left this month", es: "disponible este mes" }),
            limit: t({ en: "Limit", es: "Límite" }),
            scope: t({ en: "Everything · This month", es: "Todo · Este mes" }),
            spent: t({ en: "Spent", es: "Gastado" }),
        },
        days: [
            t({ en: "S", es: "D" }),
            t({ en: "M", es: "L" }),
            t({ en: "T", es: "M" }),
            t({ en: "W", es: "X" }),
            t({ en: "T", es: "J" }),
            t({ en: "F", es: "V" }),
            t({ en: "S", es: "S" }),
        ],
        entry: {
            account: t({ en: "account", es: "cuenta" }),
            amount: t({ en: "amount", es: "monto" }),
            category: t({ en: "category", es: "categoría" }),
            date: t({ en: "date", es: "fecha" }),
            merchant: t({ en: "merchant", es: "comercio" }),
        },
        insights: {
            income: t({ en: "Income", es: "Ingreso" }),
            label: t({
                en: "Insights for 6 to 12 Sep: $597.95 spent, 74% less than the week before. Income $1,450, net $852.05.",
                es: "Estadísticas del 6 al 12 de sep: $597.95 gastados, 74 % menos que la semana anterior. Ingresos $1,450, neto $852.05.",
            }),
            movers: t({ en: "Movers", es: "Cambios" }),
            net: t({ en: "Net", es: "Neto" }),
            note: t({
                en: "$1,685.51 less than 30 Aug – 5 Sep. Rent alone gave back $1,850.00.",
                es: "$1,685.51 menos que 30 ago – 5 sep. Solo Renta bajó $1,850.00.",
            }),
            range: t({ en: "Spent · 6 – 12 Sep", es: "Gastado · 6 – 12 sep" }),
            utilities: t({ en: "Utilities", es: "Servicios" }),
            versus: t({ en: "vs 30 Aug – 5 Sep", es: "vs. 30 ago – 5 sep" }),
            groceries: t({ en: "Groceries", es: "Súper" }),
            rent: t({ en: "Rent", es: "Renta" }),
            fresh: t({ en: "new", es: "nuevo" }),
        },
        months: {
            nov: t({ en: "Nov", es: "nov" }),
            oct: t({ en: "Oct", es: "oct" }),
            sep: t({ en: "Sep", es: "sep" }),
        },
        upcoming: {
            label: t({
                en: "Upcoming: $2,036.54 a month across Amazon Prime, ChatGPT, iCloud, Verizon, Spotify, rent, Netflix, and Planet Fitness.",
                es: "Próximos: $2,036.54 al mes entre Amazon Prime, ChatGPT, iCloud, Verizon, Spotify, renta, Netflix y Planet Fitness.",
            }),
            perMonth: t({ en: "Per month", es: "Al mes" }),
            rent: t({ en: "Rent", es: "Renta" }),
            title: t({ en: "Upcoming", es: "Próximos" }),
        },
    },
    key: "appUi",
} satisfies Dictionary;

export default appUi;
