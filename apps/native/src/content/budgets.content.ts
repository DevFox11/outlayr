import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const budgets = {
    content: {
        "budgets.action.cancel": t({
            en: "Cancel",
            es: "Cancelar",
        }),
        "budgets.action.changeLimit": t({
            en: "Change limit",
            es: "Cambiar límite",
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
        "budgets.editor.carry": t({
            en: "Carry over what's left",
            es: "Arrastrar lo que quede",
        }),
        "budgets.editor.carryNote": t({
            en: "What you don't spend is added to the next period, and what you overspend is taken off it.",
            es: "Lo que no gastes se suma al período siguiente, y lo que te pases se le resta.",
        }),
        "budgets.editor.closedWindow": t({
            en: "Editing changes the current window, not this one.",
            es: "Editar cambia la ventana actual, no esta.",
        }),
        "budgets.editor.currency": t({
            en: "Set in {from}. Saving restates it in {to}.",
            es: "Definido en {from}. Al guardar se expresa en {to}.",
        }),
        "budgets.editor.dropCarry": t({
            en: "Turning this off drops the {carry} carried in.",
            es: "Al desactivarlo se pierde el {carry} arrastrado.",
        }),
        "budgets.editor.every": t({
            en: "Every",
            es: "Cada",
        }),
        "budgets.editor.from": t({
            en: "From",
            es: "Desde",
        }),
        "budgets.editor.limit": t({
            en: "Limit",
            es: "Límite",
        }),
        "budgets.editor.limitCarry": t({
            en: "{amount} this window, with {carry} carried in",
            es: "{amount} esta ventana, con {carry} arrastrado",
        }),
        "budgets.editor.name": t({
            en: "Name",
            es: "Nombre",
        }),
        "budgets.editor.nameNote": t({
            en: "Leave it blank to keep the category's own name.",
            es: "Déjalo vacío para conservar el nombre de la categoría.",
        }),
        "budgets.editor.reslice": t({
            en: "This window becomes {window}. What was spent before it stays where it was spent.",
            es: "Esta ventana pasa a ser {window}. Lo gastado antes se queda donde se gastó.",
        }),
        "budgets.editor.title": t({
            en: "THE BUDGET",
            es: "EL PRESUPUESTO",
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
            en: "EVERYTHING · {period}",
            es: "TODO · {period}",
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
        "budgets.measure.limit": t({
            en: "LIMIT",
            es: "LÍMITE",
        }),
        "budgets.measure.perDay": t({
            en: "A DAY",
            es: "AL DÍA",
        }),
        "budgets.measure.spent": t({
            en: "SPENT",
            es: "GASTADO",
        }),
        "budgets.name.default": t({
            en: "Budget",
            es: "Presupuesto",
        }),
        "budgets.new.a11y": t({
            en: "New budget",
            es: "Nuevo presupuesto",
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
        // The chips in the period step. Title case because a chip is a label, not
        // part of a sentence — `budgets.periodPhrase.*` is the mid-sentence form.
        "budgets.periodName.day": t({
            en: "Day",
            es: "Día",
        }),
        "budgets.periodName.month": t({
            en: "Month",
            es: "Mes",
        }),
        "budgets.periodName.week": t({
            en: "Week",
            es: "Semana",
        }),
        "budgets.periodName.year": t({
            en: "Year",
            es: "Año",
        }),
        "budgets.periodPhrase.day": t({
            en: "a day",
            es: "al día",
        }),
        "budgets.periodPhrase.month": t({
            en: "a month",
            es: "al mes",
        }),
        "budgets.periodPhrase.week": t({
            en: "a week",
            es: "a la semana",
        }),
        "budgets.periodPhrase.year": t({
            en: "a year",
            es: "al año",
        }),
        "budgets.picker.commit": t({
            en: "Keep it under {amount}",
            es: "Mantenlo bajo {amount}",
        }),
        "budgets.picker.drag": t({
            en: "DRAG TO SET A LIMIT",
            es: "ARRASTRA PARA FIJAR UN LÍMITE",
        }),
        "budgets.picker.dragA11y": t({
            en: "Limit {amount} {period}. Drag up or down to change it.",
            es: "Límite {amount} {period}. Arrastra hacia arriba o abajo para cambiarlo.",
        }),
        "budgets.picker.held": t({
            en: "{window} would have held — {amount} to spare.",
            es: "{window} habría alcanzado — te sobraban {amount}.",
        }),
        "budgets.picker.nothingYet": t({
            en: "Nothing spent in {window} yet.",
            es: "Aún no has gastado en {window}.",
        }),
        "budgets.picker.ranOutEarly": t({
            en: "You would have run out on {date}, {days} early.",
            es: "Te habrías quedado sin fondos el {date}, {days} antes.",
        }),
        "budgets.picker.ranOutFinal": t({
            en: "You would have run out on {date}, the final day.",
            es: "Te habrías quedado sin fondos el {date}, el último día.",
        }),
        "budgets.picker.sparseDays": t({
            en: "Only {days} into {window} — too early to say how it would have gone.",
            es: "Solo {days} de {window} — muy pronto para saber cómo habría ido.",
        }),
        "budgets.picker.sparseExpenses": t({
            en: "Only {expenses} so far — too little to say how {window} would have gone.",
            es: "Solo {expenses} hasta ahora — muy poco para saber cómo habría ido {window}.",
        }),
        "budgets.picker.spent": t({
            en: "SPENT {amount}",
            es: "GASTADO {amount}",
        }),
        "budgets.rail.another": t({
            en: "Budget another category",
            es: "Presupuestar otra categoría",
        }),
        "budgets.rail.set": t({
            en: "Set a limit",
            es: "Poner un límite",
        }),
        "budgets.rail.title": t({
            en: "NOT BUDGETED YET",
            es: "SIN PRESUPUESTO AÚN",
        }),
        "budgets.rail.typical": t({
            en: "{amount} {period}, typically",
            es: "{amount} {period}, normalmente",
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
        // The overall budget, named for what it covers rather than for its rank.
        // The same word heads the tab, the sheet and the widget.
        "budgets.scope.everything": t({
            en: "Everything",
            es: "Todo",
        }),
        "budgets.sheet.alreadySpent": t({
            en: "Already {amount} spent. This starts you {over} over.",
            es: "Ya llevas {amount} gastado. Esto te deja {over} por encima.",
        }),
        "budgets.sheet.editLimitA11y": t({
            en: "Edit the limit",
            es: "Editar el límite",
        }),
        "budgets.sheet.lastWindows": t({
            en: "{over} of the last {total} went over",
            es: "{over} de los últimos {total} se excedieron",
        }),
        "budgets.sheet.noHistory": t({
            en: "Nothing spent on {scope} yet.",
            es: "Aún no has gastado en {scope}.",
        }),
        "budgets.sheet.perDay": t({
            en: "{amount} a day for the {days} left",
            es: "{amount} al día por los {days} que quedan",
        }),
        "budgets.sheet.singleton": t({
            en: "One overall budget at a time. This changes the one you have.",
            es: "Solo hay un presupuesto general. Esto cambia el que ya tienes.",
        }),
        // The sheet's head. Word order is the translator's: `{scope}` is a category
        // name or "everything", `{period}` is `budgets.periodPhrase.*`.
        "budgets.sheet.stated": t({
            en: "Keep {scope} under {period}",
            es: "Mantén {scope} bajo {period}",
        }),
        "budgets.sheet.tapToType": t({
            en: "tap to type",
            es: "toca para escribir",
        }),
        "budgets.sheet.typical": t({
            en: "typical {amount}",
            es: "típico {amount}",
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
