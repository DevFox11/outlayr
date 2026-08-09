import { type Dictionary, t } from "intlayer";

const log = {
	content: {
		"log.add.import": t({
			en: "Import transactions",
			es: "Importar transacciones",
		}),
		"log.add.menu": t({
			en: "Add",
			es: "Agregar",
		}),
		"log.add.transaction": t({
			en: "Create transaction",
			es: "Crear transacción",
		}),
		"log.chip.earlier": t({
			en: "Earlier",
			es: "Anterior",
		}),
		"log.chip.later": t({
			en: "Later",
			es: "Siguiente",
		}),
		"log.chip.now": t({
			en: "Now",
			es: "Ahora",
		}),
		"log.chip.remove": t({
			en: "Remove filter",
			es: "Quitar filtro",
		}),
		"log.delete.failedBody": t({
			en: "Nothing was removed, so it's back on your log. Try again.",
			es: "No se eliminó nada, así que volvió a tu registro. Inténtalo de nuevo.",
		}),
		"log.delete.failedTitle": t({
			en: "Couldn't delete the entry",
			es: "No se pudo eliminar el registro",
		}),
		"log.empty.body": t({
			en: "Your first entry sets the baseline everything else is measured against.",
			es: "Tu primer registro define la base con la que se compara todo lo demás.",
		}),
		"log.empty.title": t({
			en: "Nothing logged yet",
			es: "Aún no hay registros",
		}),
		"log.filter.all": t({
			en: "all entries",
			es: "todos los registros",
		}),
		"log.filter.category": t({
			en: "by category",
			es: "por categoría",
		}),
		"log.filter.day": t({
			en: "by day",
			es: "por día",
		}),
		"log.filter.month": t({
			en: "by month",
			es: "por mes",
		}),
		"log.filter.recurring": t({
			en: "recurring",
			es: "recurrente",
		}),
		"log.filter.transfers": t({
			en: "Transfers",
			es: "Transferencias",
		}),
		"log.filter.type": t({
			en: "by type",
			es: "por tipo",
		}),
		"log.filter.upcoming": t({
			en: "upcoming",
			es: "próximos",
		}),
		"log.filter.week": t({
			en: "by week",
			es: "por semana",
		}),
		"log.insights.also": t({
			en: "Also {period}",
			es: "También {period}",
		}),
		"log.insights.currency": t({
			en: "Currency",
			es: "Moneda",
		}),
		"log.insights.currencyManage": t({
			en: "Edit favourites…",
			es: "Editar favoritas…",
		}),
		"log.insights.currencyShown": t({
			en: "Currency shown",
			es: "Moneda mostrada",
		}),
		"log.ledger.showFigure": t({
			en: "Show this figure",
			es: "Mostrar esta cifra",
		}),
		"log.measure.in": t({
			en: "In",
			es: "Entró",
		}),
		"log.measure.net": t({
			en: "Net",
			es: "Neto",
		}),
		"log.measure.out": t({
			en: "Out",
			es: "Salió",
		}),
		"log.noResults": t({
			en: "No entries found.",
			es: "No se encontraron registros.",
		}),
		"log.period.all": t({
			en: "all time",
			es: "todo el tiempo",
		}),
		"log.period.day": t({
			en: "today",
			es: "hoy",
		}),
		"log.period.month": t({
			en: "this month",
			es: "este mes",
		}),
		"log.period.week": t({
			en: "this week",
			es: "esta semana",
		}),
		"log.period.year": t({
			en: "this year",
			es: "este año",
		}),
		"log.row.actionsHint": t({
			en: "Double tap and hold to open actions for this entry",
			es: "Toca dos veces y mantén para abrir las acciones de este registro",
		}),
		"log.row.amountExpense": t({
			en: "Expense {amount}",
			es: "Gasto de {amount}",
		}),
		"log.row.amountIncome": t({
			en: "Income {amount}",
			es: "Ingreso de {amount}",
		}),
		"log.row.amountTransfer": t({
			en: "{amount} moved",
			es: "{amount} movidos",
		}),
		"log.row.delete": t({
			en: "Delete",
			es: "Eliminar",
		}),
		"log.row.deleteAccessibility": t({
			en: "Delete transaction",
			es: "Eliminar transacción",
		}),
		"log.row.unplaced": t({
			en: "Currency not recorded, shown as {code}",
			es: "Moneda no registrada, se muestra como {code}",
		}),
		"log.scope.clear": t({
			en: "Clear",
			es: "Borrar",
		}),
		"log.scope.otherCurrencies": t({
			en: "Other currencies",
			es: "Otras monedas",
		}),
		"log.title": t({
			en: "Log",
			es: "Registro",
		}),
		"log.toolbar.filter": t({
			en: "Filter",
			es: "Filtrar",
		}),
		"log.toolbar.period": t({
			en: "Period",
			es: "Periodo",
		}),
		"log.toolbar.search": t({
			en: "Search",
			es: "Buscar",
		}),
		"log.toolbar.show": t({
			en: "Show",
			es: "Mostrar",
		}),
		"log.type.expense": t({
			en: "Expense",
			es: "Gasto",
		}),
		"log.type.income": t({
			en: "Income",
			es: "Ingreso",
		}),
		"log.undo.accessibility": t({
			en: "Undo delete",
			es: "Deshacer eliminación",
		}),
		"log.undo.action": t({
			en: "Undo",
			es: "Deshacer",
		}),
		"log.undo.deleted": t({
			en: "Log deleted",
			es: "Registro eliminado",
		}),
		"log.upcoming.heading": t({
			en: "UPCOMING",
			es: "PRÓXIMOS",
		}),
		"log.upcoming.perMonth": t({
			en: "PER MONTH",
			es: "AL MES",
		}),
	},
	key: "log" as const,
} satisfies Dictionary;

export default log;
