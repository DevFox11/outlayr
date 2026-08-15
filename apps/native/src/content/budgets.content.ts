import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const budgets = {
    content: {
        "budgets.action.cancel": t({
            en: "Cancel",
            es: "Cancelar",
        }),
        "budgets.action.close": t({
            en: "Close",
            es: "Cerrar",
        }),
        "budgets.action.delete": t({
            en: "Delete",
            es: "Eliminar",
        }),
        "budgets.action.moreA11y": t({
            en: "Budget actions",
            es: "Acciones del presupuesto",
        }),
        "budgets.card.a11yLeft": t({
            en: "{name}, {amount} left",
            es: "{name}, {amount} restante",
        }),
        "budgets.card.a11yOver": t({
            en: "{name}, {amount} over budget",
            es: "{name}, {amount} excedido",
        }),
        "budgets.days_one": t({
            en: "{count} day",
            es: "{count} día",
        }),
        "budgets.days_other": t({
            en: "{count} days",
            es: "{count} días",
        }),
        "budgets.delete.failedBody": t({
            en: "Something went wrong deleting this budget, so it is still here. Try again.",
            es: "Algo salió mal al eliminar este presupuesto, así que sigue aquí. Inténtalo de nuevo.",
        }),
        "budgets.delete.failedTitle": t({
            en: "Not deleted",
            es: "No se eliminó",
        }),
        "budgets.detail.emptyClosed": t({
            en: "Nothing was spent in this period.",
            es: "No se gastó nada en este período.",
        }),
        "budgets.detail.emptyOpen": t({
            en: "No spending in this period yet.",
            es: "Aún no hay gastos en este período.",
        }),
        "budgets.detail.leftEachDay": t({
            en: "{amount} left each day",
            es: "{amount} restante por día",
        }),
        "budgets.detail.leftPeriod": t({
            en: "left {period}",
            es: "restante {period}",
        }),
        "budgets.detail.limit": t({
            en: "{amount} limit",
            es: "{amount} límite",
        }),
        "budgets.detail.overBudget": t({
            en: "over budget",
            es: "excedido",
        }),
        "budgets.detail.overPeriod": t({
            en: "over {period}",
            es: "excedido {period}",
        }),
        "budgets.detail.percentSpent": t({
            en: "{percent}% spent",
            es: "{percent}% gastado",
        }),
        "budgets.detail.spent": t({
            en: "{amount} spent",
            es: "{amount} gastado",
        }),
        "budgets.detail.transactions": t({
            en: "TRANSACTIONS",
            es: "TRANSACCIONES",
        }),
        "budgets.detail.unspent": t({
            en: "unspent",
            es: "sin gastar",
        }),
        "budgets.edit.title": t({
            en: "Edit Budget",
            es: "Editar presupuesto",
        }),
        "budgets.empty.action": t({
            en: "Add a Transaction",
            es: "Agregar una transacción",
        }),
        "budgets.empty.body": t({
            en: "Link budgets to categories and set appropriate expenditure goals.",
            es: "Vincula presupuestos a categorías y establece metas de gasto apropiadas.",
        }),
        "budgets.empty.title": t({
            en: "Budget Your Finances",
            es: "Presupuesta tus finanzas",
        }),
        "budgets.expenses_one": t({
            en: "{count} expense",
            es: "{count} gasto",
        }),
        "budgets.expenses_other": t({
            en: "{count} expenses",
            es: "{count} gastos",
        }),
        "budgets.form.amountA11y": t({
            en: "Edit amount",
            es: "Editar monto",
        }),
        "budgets.form.category": t({
            en: "CATEGORY",
            es: "CATEGORÍA",
        }),
        "budgets.form.create": t({
            en: "Create budget",
            es: "Crear presupuesto",
        }),
        "budgets.form.defaultName": t({
            en: "Budget",
            es: "Presupuesto",
        }),
        "budgets.form.defaultOverall": t({
            en: "Overall Budget",
            es: "Presupuesto general",
        }),
        "budgets.form.kindCategory": t({
            en: "Category",
            es: "Categoría",
        }),
        "budgets.form.kindOverall": t({
            en: "Overall",
            es: "General",
        }),
        "budgets.form.name": t({
            en: "NAME",
            es: "NOMBRE",
        }),
        "budgets.form.period": t({
            en: "PERIOD",
            es: "PERÍODO",
        }),
        "budgets.form.periodDay": t({
            en: "Day",
            es: "Día",
        }),
        "budgets.form.periodMonth": t({
            en: "Month",
            es: "Mes",
        }),
        "budgets.form.periodWeek": t({
            en: "Week",
            es: "Semana",
        }),
        "budgets.form.periodYear": t({
            en: "Year",
            es: "Año",
        }),
        "budgets.form.rollover": t({
            en: "Carry over",
            es: "Arrastrar saldo",
        }),
        "budgets.form.rolloverNote": t({
            en: "What you don't spend is added to the next period, and what you overspend is taken off it.",
            es: "Lo que no gastes se suma al período siguiente, y lo que te pases se le resta.",
        }),
        "budgets.form.save": t({
            en: "Save changes",
            es: "Guardar cambios",
        }),
        "budgets.form.selectCategory": t({
            en: "Select a category",
            es: "Elige una categoría",
        }),
        "budgets.form.starts": t({
            en: "STARTS",
            es: "EMPIEZA",
        }),
        "budgets.hero.a11yLeft": t({
            en: "{name}, {amount} left {period}",
            es: "{name}, {amount} restante {period}",
        }),
        "budgets.hero.a11yOver": t({
            en: "{name}, {amount} over budget",
            es: "{name}, {amount} excedido",
        }),
        "budgets.hero.endsShort": t({
            en: "ENDS {amount} SHORT",
            es: "FALTARÁN {amount}",
        }),
        "budgets.hero.eyebrow": t({
            en: "OVERALL · {period}",
            es: "GENERAL · {period}",
        }),
        "budgets.hero.leftPeriod": t({
            en: "left {period}",
            es: "restante {period}",
        }),
        "budgets.hero.onDate": t({
            en: "{label} on {date}",
            es: "{label} el {date}",
        }),
        "budgets.hero.onTrack": t({
            en: "ON TRACK",
            es: "EN CAMINO",
        }),
        "budgets.hero.overBudget": t({
            en: "over budget",
            es: "excedido",
        }),
        "budgets.hero.ranOut": t({
            en: "RAN OUT {date}",
            es: "SE ACABÓ {date}",
        }),
        // Appended to whichever verdict fired, so the sentence names what did it
        // rather than only when it happened. Percent, not a worded fraction: "four
        // fifths" does not survive translation.
        "budgets.hero.verdictBlame": t({
            en: "{name} took {percent}% of it.",
            es: "{name} se llevó el {percent}%.",
        }),
        "budgets.hero.verdictEndsShort": t({
            en: "Still solvent, but on this pace the period ends {amount} short.",
            es: "Todavía te alcanza, pero a este ritmo al período le faltarán {amount}.",
        }),
        "budgets.hero.verdictRanOutEarly": t({
            en: "Ran out {date}, {days} early.",
            es: "Se acabó el {date}, {days} antes.",
        }),
        "budgets.hero.verdictRanOutFinal": t({
            en: "Ran out {date}, on the period's final day.",
            es: "Se acabó el {date}, el último día del período.",
        }),
        "budgets.list.budgets": t({
            en: "BUDGETS",
            es: "PRESUPUESTOS",
        }),
        "budgets.list.categories": t({
            en: "CATEGORIES",
            es: "CATEGORÍAS",
        }),
        "budgets.list.overCount": t({
            en: "{over} OF {total} OVER",
            es: "{over} DE {total} EXCEDIDOS",
        }),
        "budgets.new.a11y": t({
            en: "New budget",
            es: "Nuevo presupuesto",
        }),
        "budgets.new.title": t({
            en: "New Budget",
            es: "Nuevo presupuesto",
        }),
        "budgets.overall.title": t({
            en: "Overall Budget",
            es: "Presupuesto general",
        }),
        "budgets.perDay": t({
            en: "{amount}/day",
            es: "{amount}/día",
        }),
        "budgets.period.day": t({
            en: "today",
            es: "hoy",
        }),
        "budgets.period.month": t({
            en: "this month",
            es: "este mes",
        }),
        "budgets.period.other": t({
            en: "this period",
            es: "este período",
        }),
        "budgets.period.week": t({
            en: "this week",
            es: "esta semana",
        }),
        "budgets.period.year": t({
            en: "this year",
            es: "este año",
        }),
        "budgets.picker.cadence": t({
            en: "a month",
            es: "al mes",
        }),
        "budgets.picker.commit": t({
            en: "Use {amount} a month",
            es: "Usar {amount} al mes",
        }),
        "budgets.picker.drag": t({
            en: "DRAG TO SET A LIMIT",
            es: "ARRASTRA PARA FIJAR UN LÍMITE",
        }),
        "budgets.picker.dragA11y": t({
            en: "Monthly limit {amount}. Drag up or down to change it.",
            es: "Límite mensual {amount}. Arrastra hacia arriba o abajo para cambiarlo.",
        }),
        "budgets.picker.eyebrow": t({
            en: "{month} · NO BUDGET YET",
            es: "{month} · AÚN SIN PRESUPUESTO",
        }),
        "budgets.picker.held": t({
            en: "{month} would have held — {amount} to spare.",
            es: "{month} habría alcanzado — te sobraban {amount}.",
        }),
        "budgets.picker.ranOutEarly": t({
            en: "You would have run out on {date}, {days} early.",
            es: "Te habrías quedado sin fondos el {date}, {days} antes.",
        }),
        "budgets.picker.ranOutFinal": t({
            en: "You would have run out on {date}, the month's final day.",
            es: "Te habrías quedado sin fondos el {date}, el último día del mes.",
        }),
        "budgets.picker.sparseDays": t({
            en: "Only {days} into {month} — too early to say how it would have gone.",
            es: "Solo {days} de {month} — muy pronto para saber cómo habría ido.",
        }),
        "budgets.picker.sparseExpenses": t({
            en: "Only {expenses} so far — too little to say how {month} would have gone.",
            es: "Solo {expenses} hasta ahora — muy poco para saber cómo habría ido {month}.",
        }),
        "budgets.picker.spent": t({
            en: "SPENT {amount}",
            es: "GASTADO {amount}",
        }),
        "budgets.rings.heading": t({
            en: "Category progress",
            es: "Progreso por categoría",
        }),
        "budgets.rings.over": t({
            en: "{amount} over budget",
            es: "{amount} excedido",
        }),
        "budgets.rings.rowA11y": t({
            en: "{name}, {percent}% spent, {spent} of {limit}",
            es: "{name}, {percent}% gastado, {spent} de {limit}",
        }),
        "budgets.rings.rowA11yOver": t({
            en: "{name}, {percent}% spent, {amount} over budget",
            es: "{name}, {percent}% gastado, {amount} excedido",
        }),
        "budgets.rings.summary": t({
            en: "Category budgets ranked by urgency.",
            es: "Presupuestos por categoría ordenados por urgencia.",
        }),
        "budgets.row.actionsHint": t({
            en: "Double tap and hold to open actions for this budget",
            es: "Toca dos veces y mantén para abrir las acciones de este presupuesto",
        }),
        "budgets.row.deleteA11y": t({
            en: "Delete the {name} budget",
            es: "Eliminar el presupuesto {name}",
        }),
        "budgets.save.failedBody": t({
            en: "Something went wrong writing this budget, so nothing was saved. Try again.",
            es: "Algo salió mal al guardar este presupuesto, así que no se guardó nada. Inténtalo de nuevo.",
        }),
        "budgets.save.failedTitle": t({
            en: "Not saved",
            es: "No se guardó",
        }),
        "budgets.spentOfLimit": t({
            en: "{spent} of {limit}",
            es: "{spent} de {limit}",
        }),
        "budgets.stepper.next": t({
            en: "Next period",
            es: "Período siguiente",
        }),
        "budgets.stepper.previous": t({
            en: "Previous period",
            es: "Período anterior",
        }),
        "budgets.suffix.left": t({
            en: "left",
            es: "restante",
        }),
        "budgets.suffix.over": t({
            en: "over",
            es: "excedido",
        }),
        "budgets.title": t({
            en: "Budgets",
            es: "Presupuestos",
        }),
        "budgets.undo.deleted": t({
            en: "Budget deleted",
            es: "Presupuesto eliminado",
        }),
        "budgets.widget.none": t({
            en: "No budget yet",
            es: "Aún sin presupuesto",
        }),
    },
    key: "budgets" as const,
} satisfies Dictionary;

export default budgets;
