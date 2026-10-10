import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const alerts = {
    content: {
        "alerts.dayCard.failedBody": t({
            en: "The image couldn't be drawn.",
            es: "No se pudo generar la imagen.",
        }),
        "alerts.dayCard.failedTitle": t({
            en: "Couldn't share the day",
            es: "No se pudo compartir el día",
        }),
        "alerts.dayCard.share": t({
            en: "Share as Image",
            es: "Compartir como imagen",
        }),
        "alerts.dayCard.shareTitle": t({
            en: "Share day",
            es: "Compartir el día",
        }),
        "alerts.dayCard.undrawable": t({
            en: "The image couldn't be drawn on this device.",
            es: "No se pudo generar la imagen en este dispositivo.",
        }),
        "alerts.photo.failed": t({
            en: "Couldn't open your photos. Check Outlayr's permission and try again.",
            es: "No se pudieron abrir tus fotos. Revisa el permiso de Outlayr e inténtalo de nuevo.",
        }),
        "alerts.transaction.logAgain": t({
            en: "Log Again",
            es: "Registrar de nuevo",
        }),
        "alerts.transaction.stopRecurring": t({
            en: "Stop Recurring",
            es: "Dejar de repetir",
        }),
        "alerts.transfer.sharingUnavailable": t({
            en: "Sharing isn't available on this device.",
            es: "Compartir no está disponible en este dispositivo.",
        }),
        "alerts.transfer.unreadableFile": t({
            en: "That file couldn't be read as text.",
            es: "No se pudo leer ese archivo como texto.",
        }),
        "reminder.daily.catchUp": t({
            en: "Last: {entry}. Tap to catch up.",
            es: "Último: {entry}. Toca para ponerte al día.",
        }),
        "reminder.daily.empty": t({
            en: "Nothing logged yet",
            es: "Aún no has registrado nada",
        }),
        "reminder.daily.first": t({
            en: "Tap to add your first expense.",
            es: "Toca para agregar tu primer gasto.",
        }),
        "reminder.daily.lastOn": t({
            en: "Last: {entry}, {day}.",
            es: "Último: {entry}, el {day}.",
        }),
        "reminder.daily.lastYesterday": t({
            en: "Last: {entry}, yesterday.",
            es: "Último: {entry}, ayer.",
        }),
        "reminder.daily.since": t({
            en: "Nothing logged since {day}",
            es: "Nada registrado desde el {day}",
        }),
        "reminder.daily.today": t({
            en: "Nothing logged today",
            es: "Nada registrado hoy",
        }),
        "reminder.daily.yesterday": t({
            en: "Nothing logged yesterday",
            es: "Nada registrado ayer",
        }),
        "reminder.digest.on": t({
            en: "{count} charges on {day}",
            es: "{count} cobros el {day}",
        }),
        "reminder.digest.today": t({
            en: "{count} charges today",
            es: "{count} cobros hoy",
        }),
        "reminder.digest.tomorrow": t({
            en: "{count} charges tomorrow",
            es: "{count} cobros mañana",
        }),
        "reminder.due.untitled": t({
            en: "Subscription",
            es: "Suscripción",
        }),
    },
    key: "alerts" as const,
} satisfies Dictionary;

export default alerts;
