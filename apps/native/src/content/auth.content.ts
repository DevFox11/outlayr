import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const auth = {
    content: {
        "auth.adopt.body": t({
            en: "Choose what to keep. Only the first option keeps everything — the other two delete entries permanently.",
            es: "Elige qué quieres conservar. Solo la primera opción conserva todo; las otras dos borran entradas para siempre.",
        }),
        "auth.adopt.confirm.cancel": t({
            en: "Keep both instead",
            es: "Mejor conservar los dos",
        }),
        "auth.adopt.confirm.keepAccount": t({
            en: "This iPhone's entries will be deleted and cannot be recovered. Your account's ledger is what remains.",
            es: "Las entradas de este iPhone se borrarán y no se podrán recuperar. Solo queda el registro de tu cuenta.",
        }),
        "auth.adopt.confirm.keepLocal": t({
            en: "Your account's entries will be deleted and cannot be recovered. This iPhone's ledger is what remains.",
            es: "Las entradas de tu cuenta se borrarán y no se podrán recuperar. Solo queda el registro de este iPhone.",
        }),
        "auth.adopt.confirm.proceed": t({
            en: "Delete and continue",
            es: "Borrar y continuar",
        }),
        "auth.adopt.confirm.title": t({
            en: "This deletes entries",
            es: "Esto borra entradas",
        }),
        "auth.adopt.eyebrow": t({
            en: "Two ledgers",
            es: "Dos registros",
        }),
        "auth.adopt.failed": t({
            en: "That could not be applied. Nothing was changed on either side — try again.",
            es: "No se pudo aplicar. No cambió nada en ningún lado. Inténtalo de nuevo.",
        }),
        "auth.adopt.keepAccount.body": t({
            en: "Deletes every entry on this iPhone and replaces it with your account's ledger.",
            es: "Borra cada entrada de este iPhone y la reemplaza con el registro de tu cuenta.",
        }),
        "auth.adopt.keepAccount.title": t({
            en: "Keep only the account's",
            es: "Conservar solo el de la cuenta",
        }),
        "auth.adopt.keepLocal.body": t({
            en: "Deletes every entry your account holds and replaces it with this iPhone's ledger.",
            es: "Borra cada entrada que tiene tu cuenta y la reemplaza con el registro de este iPhone.",
        }),
        "auth.adopt.keepLocal.title": t({
            en: "Keep only this iPhone's",
            es: "Conservar solo el de este iPhone",
        }),
        "auth.adopt.merge.body": t({
            en: "Every entry from this iPhone and from your account survives. Nothing is deleted. Duplicate categories are yours to tidy up afterwards.",
            es: "Se quedan todas las entradas de este iPhone y de tu cuenta. No se borra nada. Si quedan categorías duplicadas, puedes ordenarlas después.",
        }),
        "auth.adopt.merge.title": t({
            en: "Keep both",
            es: "Conservar los dos",
        }),
        "auth.adopt.title": t({
            en: "This iPhone and your account both hold entries",
            es: "Este iPhone y tu cuenta tienen entradas",
        }),
        "auth.adopt.working": t({
            en: "Reconciling…",
            es: "Conciliando…",
        }),
        "auth.google.continue": t({
            en: "Continue with Google",
            es: "Continuar con Google",
        }),
        "auth.restoring.title": t({
            en: "Opening your ledger",
            es: "Abriendo tu registro",
        }),
        "auth.signIn.agreement": t({
            en: "By using Outlayr, you agree to the {terms} and {privacy}.",
            es: "Al usar Outlayr, aceptas los {terms} y la {privacy}.",
        }),
        "auth.signIn.begun": t({
            en: "Begun {date}.",
            es: "Comenzado el {date}.",
        }),
        "auth.signIn.body": t({
            en: "Your ledger is on this phone and it stays there. An account means it survives losing the phone.",
            es: "Tu registro vive en este celular y ahí se queda. Con una cuenta, sobrevive aunque pierdas el celular.",
        }),
        "auth.signIn.eyebrow": t({
            en: "Account",
            es: "Cuenta",
        }),
        "auth.signIn.kept": t({
            en: "Kept in {currency}.",
            es: "Se lleva en {currency}.",
        }),
        "auth.signIn.notNow": t({
            en: "Not now — open my ledger",
            es: "Ahora no, abrir mi registro",
        }),
        "auth.signIn.offline": t({
            en: "Signing in needs a connection. Once you have, your ledger opens offline.",
            es: "Para iniciar sesión necesitas conexión. Después, tu registro abre sin conexión.",
        }),
        "auth.signIn.pending": t({
            en: "Signing in…",
            es: "Iniciando sesión…",
        }),
        "auth.signIn.title": t({
            en: "Keep a copy of this?",
            es: "¿Quieres guardar una copia?",
        }),
        "auth.signIn.written": t({
            en: "Written daily at {time}.",
            es: "Se escribe a diario a las {time}.",
        }),
    },
    key: "auth" as const,
} satisfies Dictionary;

export default auth;
