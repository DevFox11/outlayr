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
        "reminder.body": t({
            en: "Log what you spent today.",
            es: "Registra lo que gastaste hoy.",
        }),
        "reminder.due.untitled": t({
            en: "Subscription",
            es: "Suscripción",
        }),
        "reminder.title": t({
            en: "Keep the streak going",
            es: "No pierdas la racha",
        }),
    },
    key: "alerts" as const,
} satisfies Dictionary;

export default alerts;
