import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const pro = {
    content: {
        "pro.action.see": t({
            en: "See Outlayr Pro",
            es: "Ver Outlayr Pro",
        }),
        "pro.alreadyActive": t({
            en: "Pro is active on this store account.",
            es: "Pro está activo en esta cuenta de la tienda.",
        }),
        "pro.col.free": t({
            en: "Free",
            es: "Gratis",
        }),
        "pro.col.pro": t({
            en: "Pro",
            es: "Pro",
        }),
        "pro.cta.continue": t({
            en: "Continue",
            es: "Continuar",
        }),
        "pro.cta.start": t({
            en: "Start {days} days free",
            es: "Empezar {days} días gratis",
        }),
        "pro.cta.then": t({
            en: "then {price}",
            es: "luego {price}",
        }),
        "pro.entry.title": t({
            en: "Outlayr Pro",
            es: "Outlayr Pro",
        }),
        "pro.entry.value": t({
            en: "Free plan",
            es: "Plan gratis",
        }),
        "pro.entry.valuePro": t({
            en: "Active",
            es: "Activo",
        }),
        "pro.eyebrow": t({
            en: "Outlayr Pro",
            es: "Outlayr Pro",
        }),
        "pro.failedBody": t({
            en: "The purchase did not finish. If the store charged you, Restore will unlock Pro.",
            es: "La compra no terminó. Si la tienda te cobró, Restaurar activará Pro.",
        }),
        "pro.legal.privacy": t({
            en: "Privacy",
            es: "Privacidad",
        }),
        "pro.legal.restore": t({
            en: "Restore",
            es: "Restaurar",
        }),
        "pro.legal.terms": t({
            en: "Terms",
            es: "Términos",
        }),
        "pro.needsAccount": t({
            en: "Sign in before buying Pro, so the purchase follows your ledger to every device.",
            es: "Inicia sesión antes de comprar Pro, para que la compra siga tu registro en cada dispositivo.",
        }),
        "pro.needsCloud": t({
            en: "This build has no Outlayr account service, so most of Pro has nowhere to run. Nothing is for sale here.",
            es: "Esta versión no tiene el servicio de cuentas de Outlayr, así que la mayor parte de Pro no tiene dónde funcionar. Aquí no hay nada en venta.",
        }),
        "pro.nothingRestoredBody": t({
            en: "Nothing restored an active Pro on this store account.",
            es: "Nada restauró un Pro activo en esta cuenta de la tienda.",
        }),
        "pro.plan.annual": t({
            en: "Yearly",
            es: "Anual",
        }),
        "pro.plan.bestValue": t({
            en: "Best value",
            es: "Mejor valor",
        }),
        "pro.plan.lifetime": t({
            en: "Lifetime",
            es: "De por vida",
        }),
        "pro.plan.monthly": t({
            en: "Monthly",
            es: "Mensual",
        }),
        "pro.plan.once": t({
            en: "once",
            es: "una vez",
        }),
        "pro.plan.perMonth": t({
            en: "{price} / mo",
            es: "{price} / mes",
        }),
        "pro.plan.perMonthBare": t({
            en: "/ mo",
            es: "/ mes",
        }),
        "pro.plan.save": t({
            en: "Save {percent}%",
            es: "Ahorra {percent}%",
        }),
        "pro.plan.trial": t({
            en: "{days} days free",
            es: "{days} días gratis",
        }),
        "pro.restoreFailedBody": t({
            en: "The restore could not be completed. Check the connection and try again.",
            es: "No se pudo completar la restauración. Revisa la conexión e inténtalo de nuevo.",
        }),
        "pro.restorePendingBody": t({
            en: "Pro was restored, but the server has not confirmed it yet. Try again in a moment.",
            es: "Pro se restauró, pero el servidor aún no lo confirma. Inténtalo en un momento.",
        }),
        "pro.retry": t({
            en: "Try again",
            es: "Intentar de nuevo",
        }),
        "pro.row.accounts": t({
            en: "Accounts",
            es: "Cuentas",
        }),
        "pro.row.budgets": t({
            en: "Category budgets",
            es: "Presupuestos por categoría",
        }),
        "pro.row.captures": t({
            en: "Captures / 30 days",
            es: "Capturas / 30 días",
        }),
        "pro.row.currencies": t({
            en: "Account currencies",
            es: "Monedas de cuentas",
        }),
        "pro.row.devices": t({
            en: "Sync across devices",
            es: "Sync entre dispositivos",
        }),
        "pro.row.icons": t({
            en: "App icons",
            es: "Iconos",
        }),
        "pro.row.import": t({
            en: "AI matching on import",
            es: "Coincidencia con IA al importar",
        }),
        "pro.row.lookup": t({
            en: "Web merchant lookup",
            es: "Búsqueda web de comercios",
        }),
        "pro.row.photos": t({
            en: "Receipt photo backup",
            es: "Respaldo de fotos",
        }),
        "pro.syncPendingBody": t({
            en: "The purchase went through, but the server has not confirmed it yet. Try again in a moment.",
            es: "La compra se completó, pero el servidor aún no la confirma. Inténtalo en un momento.",
        }),
        "pro.title": t({
            en: "What upgrading changes",
            es: "Qué cambia al mejorar",
        }),
        "pro.unavailable": t({
            en: "Plans are not available right now.",
            es: "Los planes no están disponibles ahora.",
        }),
        "pro.unconfirmed": t({
            en: "Pro is active on this store account, but the server has not confirmed it, so syncing and the AI features stay off until it does.",
            es: "Pro está activo en esta cuenta de la tienda, pero el servidor no lo ha confirmado, así que la sincronización y las funciones con IA siguen apagadas hasta que lo haga.",
        }),
        "pro.unentitledBody": t({
            en: "The purchase completed but Pro did not unlock. Try Restore, and write to support if it stays locked.",
            es: "La compra se completó pero Pro no se activó. Prueba Restaurar y escribe a soporte si sigue bloqueado.",
        }),
        "pro.value.off": t({
            en: "off",
            es: "no",
        }),
        "pro.value.on": t({
            en: "on",
            es: "sí",
        }),
        "pro.value.web": t({
            en: "web",
            es: "web",
        }),
    },
    key: "pro" as const,
} satisfies Dictionary;

export default pro;
