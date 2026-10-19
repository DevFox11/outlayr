import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const insights = {
    content: {
        "insights.balance": t({
            en: "Balance",
            es: "Saldo",
        }),
        "insights.burndown.holding": t({
            en: "Burn-down chart, day {day} of {days}, {percent} percent of the limit left",
            es: "Gráfico de consumo, día {day} de {days}, queda el {percent} por ciento del límite",
        }),
        "insights.burndown.over": t({
            en: "Burn-down chart, day {day} of {days}, {percent} percent over the limit",
            es: "Gráfico de consumo, día {day} de {days}, {percent} por ciento por encima del límite",
        }),
        "insights.calendar.day": t({
            en: "{date}, {amount} spent",
            es: "{date}, {amount} gastados",
        }),
        "insights.calendar.dayApproximate": t({
            en: "{date}, approximately {amount} spent",
            es: "{date}, aproximadamente {amount} gastados",
        }),
        "insights.calendar.empty": t({
            en: "No spending in the last six months.",
            es: "Sin gastos en los últimos seis meses.",
        }),
        "insights.calendar.less": t({
            en: "Less",
            es: "Menos",
        }),
        "insights.calendar.more": t({
            en: "More",
            es: "Más",
        }),
        "insights.calendar.range": t({
            en: "Last six months",
            es: "Últimos seis meses",
        }),
        "insights.calendar.title": t({
            en: "Spending",
            es: "Gastos",
        }),
        "insights.categories": t({
            en: "Categories",
            es: "Categorías",
        }),
        "insights.category.clearFilter": t({
            en: "Clear category filter",
            es: "Quitar filtro de categoría",
        }),
        "insights.category.share": t({
            en: "{name} {percent} percent",
            es: "{name} {percent} por ciento",
        }),
        "insights.list.empty": t({
            en: "No entries found.",
            es: "No se encontraron registros.",
        }),
        "insights.list.more": t({
            en: "{count} more",
            es: "{count} más",
        }),
        "insights.list.showAll": t({
            en: "Show all",
            es: "Ver todo",
        }),
        "insights.measure.income": t({
            en: "Income",
            es: "Ingreso",
        }),
        "insights.measure.net": t({
            en: "Net",
            es: "Neto",
        }),
        "insights.measure.spent": t({
            en: "Spent",
            es: "Gastado",
        }),
        "insights.movers.new": t({
            en: "new",
            es: "nuevo",
        }),
        "insights.movers.title": t({
            en: "Movers",
            es: "Cambios",
        }),
        "insights.movers.versus": t({
            en: "vs {label}",
            es: "vs. {label}",
        }),
        "insights.net.slotAhead": t({
            en: "{date}, balance {amount} ahead",
            es: "{date}, saldo {amount} a favor",
        }),
        "insights.net.slotBehind": t({
            en: "{date}, balance {amount} behind",
            es: "{date}, saldo {amount} en contra",
        }),
        "insights.netWorth.change": t({
            en: "{amount} over six months",
            es: "{amount} en seis meses",
        }),
        "insights.netWorth.heading": t({
            en: "Net worth",
            es: "Patrimonio",
        }),
        "insights.netWorth.summary": t({
            en: "Net worth. {amount} on {date}.",
            es: "Patrimonio. {amount} el {date}.",
        }),
        "insights.netWorth.summaryApproximate": t({
            en: "Net worth. About {amount} on {date}.",
            es: "Patrimonio. Aproximadamente {amount} el {date}.",
        }),
        "insights.period.change": t({
            en: "Change period",
            es: "Cambiar período",
        }),
        "insights.period.month": t({
            en: "Month",
            es: "Mes",
        }),
        "insights.period.week": t({
            en: "Week",
            es: "Semana",
        }),
        "insights.period.year": t({
            en: "Year",
            es: "Año",
        }),
        "insights.quiet.accessibility": t({
            en: "{measure} has nothing to chart {period}. {sentence}",
            es: "{measure} no tiene nada que graficar {period}. {sentence}",
        }),
        "insights.quiet.alternative": t({
            en: "{measure} has {period} covered — tap it above.",
            es: "{measure} sí tiene datos {period}. Tócalo arriba.",
        }),
        "insights.quiet.empty": t({
            en: "Nothing logged {period}.",
            es: "Nada registrado {period}.",
        }),
        "insights.quiet.thisMonth": t({
            en: "this month",
            es: "este mes",
        }),
        "insights.quiet.thisWeek": t({
            en: "this week",
            es: "esta semana",
        }),
        "insights.quiet.thisYear": t({
            en: "this year",
            es: "este año",
        }),
        "insights.quiet.title": t({
            en: "Nothing to chart",
            es: "Nada que graficar",
        }),
        "insights.sample.badge": t({
            en: "Sample",
            es: "Ejemplo",
        }),
        "insights.sample.body": t({
            en: "Yours starts filling in from your first entry.",
            es: "El tuyo empieza a llenarse desde tu primer registro.",
        }),
        "insights.sample.cta": t({
            en: "Log your first expense",
            es: "Registra tu primer gasto",
        }),
        "insights.sample.dining": t({
            en: "Dining Out",
            es: "Restaurantes",
        }),
        "insights.sample.groceries": t({
            en: "Groceries",
            es: "Súper",
        }),
        "insights.sample.headline": t({
            en: "This is what a month looks like",
            es: "Así se ve un mes",
        }),
        "insights.sample.month": t({
            en: "March",
            es: "Marzo",
        }),
        "insights.sample.priorLabel": t({
            en: "February",
            es: "Febrero",
        }),
        "insights.sample.verdict": t({
            en: "{delta} less than February. {category} alone gave back {moved}.",
            es: "{delta} menos que febrero. Solo {category} bajó {moved}.",
        }),
        "insights.scope.clearBar": t({
            en: "Clear the selected bar",
            es: "Quitar la barra seleccionada",
        }),
        "insights.scope.clearCategory": t({
            en: "Clear the category filter",
            es: "Quitar el filtro de categoría",
        }),
        "insights.scope.filteredCategory": t({
            en: "Filtered category",
            es: "Categoría filtrada",
        }),
        "insights.scope.selectedPeriod": t({
            en: "Selected period",
            es: "Período seleccionado",
        }),
        "insights.title": t({
            en: "Insights",
            es: "Estadísticas",
        }),
        "insights.trend.dailyTotals": t({
            en: "Chart of daily totals",
            es: "Gráfico de totales diarios",
        }),
        "insights.trend.falling": t({
            en: "Trend line, falling",
            es: "Línea de tendencia, a la baja",
        }),
        "insights.trend.flat": t({
            en: "Trend line, flat",
            es: "Línea de tendencia, estable",
        }),
        "insights.trend.monthlyTotals": t({
            en: "Chart of monthly totals",
            es: "Gráfico de totales mensuales",
        }),
        "insights.trend.rising": t({
            en: "Trend line, rising",
            es: "Línea de tendencia, al alza",
        }),
        "insights.window.earlier": t({
            en: "Earlier",
            es: "Anterior",
        }),
        "insights.window.later": t({
            en: "Later",
            es: "Siguiente",
        }),
        "insights.window.now": t({
            en: "Now",
            es: "Ahora",
        }),
        "insights.window.shown": t({
            en: "Window shown",
            es: "Fechas mostradas",
        }),
        "insights.window.title": t({
            en: "Window",
            es: "Fechas",
        }),
    },
    key: "insights" as const,
} satisfies Dictionary;

export default insights;
