import { type Dictionary, t } from "intlayer";

const insights = {
	key: "insights" as const,
	content: {
		"insights.title": t({
			en: "Insights",
			es: "Estadísticas",
		}),
		"insights.period.week": t({
			en: "Week",
			es: "Semana",
		}),
		"insights.period.month": t({
			en: "Month",
			es: "Mes",
		}),
		"insights.period.year": t({
			en: "Year",
			es: "Año",
		}),
		"insights.period.change": t({
			en: "Change period",
			es: "Cambiar período",
		}),
		"insights.measure.spent": t({
			en: "Spent",
			es: "Gastado",
		}),
		"insights.measure.income": t({
			en: "Income",
			es: "Ingreso",
		}),
		"insights.measure.net": t({
			en: "Net",
			es: "Neto",
		}),
		"insights.balance": t({
			en: "Balance",
			es: "Saldo",
		}),
		"insights.window.title": t({
			en: "Window",
			es: "Ventana",
		}),
		"insights.window.shown": t({
			en: "Window shown",
			es: "Ventana mostrada",
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
		"insights.scope.selectedPeriod": t({
			en: "Selected period",
			es: "Período seleccionado",
		}),
		"insights.scope.clearBar": t({
			en: "Clear the selected bar",
			es: "Quitar la barra seleccionada",
		}),
		"insights.scope.filteredCategory": t({
			en: "Filtered category",
			es: "Categoría filtrada",
		}),
		"insights.scope.clearCategory": t({
			en: "Clear the category filter",
			es: "Quitar el filtro de categoría",
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
		"insights.movers.title": t({
			en: "Movers",
			es: "Cambios",
		}),
		"insights.movers.versus": t({
			en: "vs {label}",
			es: "vs. {label}",
		}),
		"insights.movers.new": t({
			en: "new",
			es: "nuevo",
		}),
		"insights.net.slotAhead": t({
			en: "{date}, balance {amount} ahead",
			es: "{date}, saldo {amount} a favor",
		}),
		"insights.net.slotBehind": t({
			en: "{date}, balance {amount} behind",
			es: "{date}, saldo {amount} en contra",
		}),
		"insights.quiet.title": t({
			en: "Nothing to chart",
			es: "Nada que graficar",
		}),
		"insights.quiet.alternative": t({
			en: "{measure} has {period} covered — tap it above.",
			es: "{measure} ya cubre {period} — tócalo arriba.",
		}),
		"insights.quiet.empty": t({
			en: "Nothing logged {period}.",
			es: "Nada registrado {period}.",
		}),
		"insights.quiet.accessibility": t({
			en: "{measure} has nothing to chart {period}. {sentence}",
			es: "{measure} no tiene nada que graficar {period}. {sentence}",
		}),
		"insights.quiet.thisWeek": t({
			en: "this week",
			es: "esta semana",
		}),
		"insights.quiet.thisMonth": t({
			en: "this month",
			es: "este mes",
		}),
		"insights.quiet.thisYear": t({
			en: "this year",
			es: "este año",
		}),
		"insights.list.empty": t({
			en: "No entries found.",
			es: "No se encontraron registros.",
		}),
		"insights.sample.badge": t({
			en: "Sample",
			es: "Ejemplo",
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
			es: "{delta} menos que febrero. Solo {category} devolvió {moved}.",
		}),
		"insights.sample.dining": t({
			en: "Dining Out",
			es: "Restaurantes",
		}),
		"insights.sample.groceries": t({
			en: "Groceries",
			es: "Víveres",
		}),
		"insights.sample.headline": t({
			en: "This is what a month looks like",
			es: "Así se ve un mes",
		}),
		"insights.sample.body": t({
			en: "Yours starts filling in from your first entry.",
			es: "El tuyo empieza a llenarse desde tu primer registro.",
		}),
		"insights.sample.cta": t({
			en: "Log your first expense",
			es: "Registra tu primer gasto",
		}),
	},
} satisfies Dictionary;

export default insights;
