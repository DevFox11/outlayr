import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const goals = {
    content: {
        "goals.a11y.openHint": t({
            en: "Opens the goal",
            es: "Abre la meta",
        }),
        "goals.a11y.row": t({
            en: "{name}. {saved} of {target}, {percent} percent.",
            es: "{name}. {saved} de {target}, {percent} por ciento.",
        }),
        "goals.add": t({
            en: "Add goal",
            es: "Agregar meta",
        }),
        "goals.edit.title": t({
            en: "Edit Goal",
            es: "Editar meta",
        }),
        "goals.form.account": t({
            en: "Account",
            es: "Cuenta",
        }),
        "goals.form.accountLocked": t({
            en: "Progress is this account's balance, so it cannot be swapped later.",
            es: "El progreso es el saldo de esta cuenta, así que no se puede cambiar después.",
        }),
        "goals.form.by": t({
            en: "By a date",
            es: "Para una fecha",
        }),
        "goals.form.chooseAccount": t({
            en: "Choose account",
            es: "Elegir cuenta",
        }),
        "goals.form.create": t({
            en: "Create Goal",
            es: "Crear meta",
        }),
        "goals.form.defaultName": t({
            en: "Savings goal",
            es: "Meta de ahorro",
        }),
        "goals.form.failedBody": t({
            en: "Something went wrong saving this goal. Try again.",
            es: "Algo salió mal al guardar esta meta. Inténtalo de nuevo.",
        }),
        "goals.form.failedTitle": t({
            en: "Couldn't save the goal",
            es: "No se pudo guardar la meta",
        }),
        "goals.form.name": t({
            en: "Name",
            es: "Nombre",
        }),
        "goals.form.noDateNote": t({
            en: "Without a date there is no monthly pace to hold to.",
            es: "Sin fecha no hay un ritmo mensual que mantener.",
        }),
        "goals.form.save": t({
            en: "Save Goal",
            es: "Guardar meta",
        }),
        "goals.form.targetA11y": t({
            en: "Edit target amount",
            es: "Editar monto objetivo",
        }),
        "goals.heading": t({
            en: "Goals",
            es: "Metas",
        }),
        "goals.new.title": t({
            en: "New Goal",
            es: "Nueva meta",
        }),
        "goals.pace": t({
            en: "{amount} a month to stay on track",
            es: "{amount} al mes para llegar a tiempo",
        }),
        "goals.reached": t({
            en: "Reached",
            es: "Alcanzada",
        }),
        "goals.remaining": t({
            en: "{amount} to go",
            es: "Faltan {amount}",
        }),
    },
    key: "goals" as const,
} satisfies Dictionary;

export default goals;
