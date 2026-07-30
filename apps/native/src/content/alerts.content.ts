import { type Dictionary, t } from "intlayer";

const alerts = {
	key: "alerts" as const,
	content: {
		"alerts.transaction.fallbackTitle": t({
			en: "Transaction",
			es: "Transacción",
		}),
		"alerts.transaction.stopRecurring": t({
			en: "Stop Recurring",
			es: "Detener recurrencia",
		}),
		"alerts.transaction.stopNamed": t({
			en: "Stop recurring '{note}'?",
			es: "¿Detener la recurrencia de '{note}'?",
		}),
		"alerts.transaction.stopUnnamed": t({
			en: "Stop recurring?",
			es: "¿Detener la recurrencia?",
		}),
		"alerts.transaction.stopPending": t({
			en: "The charge already scheduled still lands. Nothing is logged after it.",
			es: "El cargo ya programado se registrará. Después de ese no se registra nada.",
		}),
		"alerts.transaction.stopSettled": t({
			en: "It will no longer be logged automatically. Entries already logged are kept.",
			es: "Ya no se registrará automáticamente. Los registros que ya existen se conservan.",
		}),
		"alerts.budget.fallbackTitle": t({
			en: "Overall Budget",
			es: "Presupuesto general",
		}),
		"alerts.budget.deleteNamed": t({
			en: "Delete the '{name}' budget?",
			es: "¿Eliminar el presupuesto '{name}'?",
		}),
		"alerts.budget.deleteOverall": t({
			en: "Delete the overall budget?",
			es: "¿Eliminar tu presupuesto general?",
		}),
		"alerts.budget.irreversible": t({
			en: "This action cannot be undone.",
			es: "Esta acción no se puede deshacer.",
		}),
		"alerts.dayCard.share": t({
			en: "Share as Image",
			es: "Compartir como imagen",
		}),
		"alerts.dayCard.failedTitle": t({
			en: "Couldn't share the day",
			es: "No se pudo compartir el día",
		}),
		"alerts.dayCard.failedBody": t({
			en: "The image couldn't be drawn.",
			es: "No se pudo dibujar la imagen.",
		}),
		"reminder.title": t({
			en: "Keep the streak going",
			es: "Mantén la racha",
		}),
		"reminder.body": t({
			en: "Log what you spent today.",
			es: "Registra lo que gastaste hoy.",
		}),
		"reminder.due.untitled": t({
			en: "Subscription",
			es: "Suscripción",
		}),
		"reminder.due.body": t({
			en: "{amount} comes out on {date}.",
			es: "{amount} se cobra el {date}.",
		}),
	},
} satisfies Dictionary;

export default alerts;
