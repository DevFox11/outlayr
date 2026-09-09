import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const voice = {
    content: {
        "voice.action.edit": t({
            en: "Edit",
            es: "Editar",
        }),
        "voice.action.finish": t({
            en: "Finish in the form",
            es: "Terminar en el formulario",
        }),
        "voice.action.fix": t({
            en: "Fix it",
            es: "Corregir",
        }),
        "voice.action.retry": t({
            en: "Say it again",
            es: "Repetir",
        }),
        "voice.action.save": t({
            en: "Save",
            es: "Guardar",
        }),
        "voice.action.settings": t({
            en: "Open Settings",
            es: "Abrir Ajustes",
        }),
        "voice.close": t({
            en: "Close",
            es: "Cerrar",
        }),
        // Failures name what happened, not what the code did.
        "voice.failed.denied": t({
            en: "Outlayr needs the microphone to hear you.",
            es: "Outlayr necesita el micrófono para escucharte.",
        }),
        "voice.failed.notConfigured": t({
            en: "Speaking an entry needs the cloud tier.",
            es: "Dictar un registro necesita el nivel en la nube.",
        }),
        "voice.failed.notEntitled": t({
            en: "Your free captures, voice and receipts together, are used up. They come back within 30 days; Pro lifts the limit.",
            es: "Tus capturas gratis, entre voz y recibos, ya se usaron. Vuelven en menos de 30 días; Pro quita ese límite.",
        }),
        "voice.failed.offline": t({
            en: "You're offline.",
            es: "Estás sin conexión.",
        }),
        "voice.failed.provider": t({
            en: "Couldn't write that down.",
            es: "No pude anotarlo.",
        }),
        "voice.failed.quotaExceeded": t({
            en: "The fair-use limit for captures is reached. It resets within 30 days.",
            es: "Se alcanzó el límite de uso justo de capturas. Se reinicia en menos de 30 días.",
        }),
        "voice.failed.rateLimited": t({
            en: "That's a lot of entries at once. Give it a moment.",
            es: "Son muchos registros seguidos. Espera un momento.",
        }),
        "voice.failed.silent": t({
            en: "Didn't hear anything.",
            es: "No escuché nada.",
        }),
        "voice.failed.timeout": t({
            en: "That took too long.",
            es: "Tardó demasiado.",
        }),
        "voice.failed.unauthenticated": t({
            en: "Sign in to speak an entry.",
            es: "Inicia sesión para dictar un registro.",
        }),
        "voice.failed.unclear": t({
            en: "Didn't catch a transaction in that.",
            es: "No entendí una transacción ahí.",
        }),
        "voice.mic.finish": t({
            en: "Done speaking",
            es: "Terminé de hablar",
        }),
        "voice.mic.retry": t({
            en: "Say it again",
            es: "Repetir",
        }),
        // The review reads as one line: "$12.50 at Starbucks · Coffee · yesterday".
        "voice.review.at": t({
            en: "at",
            es: "en",
        }),
        "voice.review.from": t({
            en: "from",
            es: "de",
        }),
        "voice.review.noAccount": t({
            en: "Which account?",
            es: "¿Qué cuenta?",
        }),
        "voice.review.noCategory": t({
            en: "No category yet",
            es: "Sin categoría aún",
        }),
        // A transfer reads as "Checking to Savings"; either side may be unresolved.
        "voice.review.noMerchant": t({
            en: "No name yet",
            es: "Sin nombre aún",
        }),
        "voice.review.transfer": t({
            en: "{from} to {to}",
            es: "{from} a {to}",
        }),
        "voice.review.transferLabel": t({
            en: "Transfer",
            es: "Transferencia",
        }),
        "voice.saved": t({
            en: "Saved",
            es: "Guardado",
        }),
        "voice.state.listening": t({
            en: "Listening…",
            es: "Escuchando…",
        }),
        "voice.state.starting": t({
            en: "Getting ready…",
            es: "Preparando…",
        }),
        "voice.state.thinking": t({
            en: "Writing it down…",
            es: "Anotando…",
        }),
        "voice.title": t({
            en: "Speak an entry",
            es: "Dictar un registro",
        }),
        // The thread strip: what was said, and what each answer changed.
        "voice.turn.draft": t({
            en: "Draft",
            es: "Borrador",
        }),
        "voice.turn.field.account": t({
            en: "account",
            es: "cuenta",
        }),
        "voice.turn.field.amount": t({
            en: "amount",
            es: "monto",
        }),
        "voice.turn.field.category": t({
            en: "category",
            es: "categoría",
        }),
        "voice.turn.field.date": t({
            en: "date",
            es: "fecha",
        }),
        "voice.turn.field.details": t({
            en: "details",
            es: "detalles",
        }),
        "voice.turn.field.kind": t({
            en: "kind",
            es: "tipo",
        }),
        "voice.turn.field.merchant": t({
            en: "name",
            es: "nombre",
        }),
        "voice.turn.field.schedule": t({
            en: "schedule",
            es: "frecuencia",
        }),
        "voice.turn.unchanged": t({
            en: "Same as before",
            es: "Igual que antes",
        }),
        "voice.turn.unclear": t({
            en: "Not a transaction",
            es: "No es una transacción",
        }),
        "voice.turn.updated": t({
            en: "Updated",
            es: "Actualizado",
        }),
    },
    key: "voice" as const,
} satisfies Dictionary;

export default voice;
