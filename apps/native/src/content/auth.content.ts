import { type Dictionary, t } from "intlayer";

const auth = {
	key: "auth" as const,
	content: {
		"auth.signIn.eyebrow": t({
			en: "Account",
			es: "Cuenta",
		}),
		"auth.signIn.title": t({
			en: "Keep a copy of this?",
			es: "¿Guardar una copia de esto?",
		}),
		"auth.signIn.body": t({
			en: "Your ledger is on this phone and it stays there. An account means it survives losing the phone.",
			es: "Tu registro está en este teléfono y ahí se queda. Una cuenta hace que sobreviva si pierdes el teléfono.",
		}),
		"auth.signIn.notNow": t({
			en: "Not now — open my ledger",
			es: "Ahora no — abrir mi registro",
		}),
		"auth.signIn.begun": t({
			en: "Begun {date}.",
			es: "Comenzado el {date}.",
		}),
		"auth.signIn.kept": t({
			en: "Kept in {currency}.",
			es: "Se lleva en {currency}.",
		}),
		"auth.signIn.written": t({
			en: "Written daily at {time}.",
			es: "Se escribe a diario a las {time}.",
		}),
		"auth.signIn.offline": t({
			en: "Signing in needs a connection. Once you have, your ledger opens offline.",
			es: "Iniciar sesión requiere conexión. Después de hacerlo, tu registro abre sin conexión.",
		}),
		"auth.restoring.title": t({
			en: "Opening your ledger",
			es: "Abriendo tu registro",
		}),
		"auth.adopt.eyebrow": t({
			en: "Two ledgers",
			es: "Dos registros",
		}),
		"auth.adopt.title": t({
			en: "This iPhone and your account both hold entries",
			es: "Este iPhone y tu cuenta tienen entradas",
		}),
		"auth.adopt.body": t({
			en: "Choose what to keep. Only the first option keeps everything — the other two delete entries permanently.",
			es: "Elige qué conservar. Solo la primera opción conserva todo — las otras dos borran entradas de forma permanente.",
		}),
		"auth.adopt.merge.title": t({
			en: "Keep both",
			es: "Conservar ambos",
		}),
		"auth.adopt.merge.body": t({
			en: "Every entry from this iPhone and from your account survives. Nothing is deleted. Duplicate categories are yours to tidy up afterwards.",
			es: "Cada entrada de este iPhone y de tu cuenta sobrevive. No se borra nada. Las categorías duplicadas quedan para que las ordenes después.",
		}),
		"auth.adopt.keepLocal.title": t({
			en: "Keep only this iPhone's",
			es: "Conservar solo el de este iPhone",
		}),
		"auth.adopt.keepLocal.body": t({
			en: "Deletes every entry your account holds and replaces it with this iPhone's ledger.",
			es: "Borra cada entrada que tiene tu cuenta y la reemplaza con el registro de este iPhone.",
		}),
		"auth.adopt.keepAccount.title": t({
			en: "Keep only the account's",
			es: "Conservar solo el de la cuenta",
		}),
		"auth.adopt.keepAccount.body": t({
			en: "Deletes every entry on this iPhone and replaces it with your account's ledger.",
			es: "Borra cada entrada de este iPhone y la reemplaza con el registro de tu cuenta.",
		}),
		"auth.adopt.confirm.title": t({
			en: "This deletes entries",
			es: "Esto borra entradas",
		}),
		"auth.adopt.confirm.keepLocal": t({
			en: "Your account's entries will be deleted and cannot be recovered. This iPhone's ledger is what remains.",
			es: "Las entradas de tu cuenta se borrarán y no se podrán recuperar. El registro de este iPhone es lo que queda.",
		}),
		"auth.adopt.confirm.keepAccount": t({
			en: "This iPhone's entries will be deleted and cannot be recovered. Your account's ledger is what remains.",
			es: "Las entradas de este iPhone se borrarán y no se podrán recuperar. El registro de tu cuenta es lo que queda.",
		}),
		"auth.adopt.confirm.cancel": t({
			en: "Keep both instead",
			es: "Mejor conservar ambos",
		}),
		"auth.adopt.confirm.proceed": t({
			en: "Delete and continue",
			es: "Borrar y continuar",
		}),
		"auth.adopt.working": t({
			en: "Reconciling…",
			es: "Reconciliando…",
		}),
		"auth.adopt.failed": t({
			en: "That could not be applied. Nothing was changed on either side — try again.",
			es: "No se pudo aplicar. No se cambió nada en ninguno de los dos lados — inténtalo de nuevo.",
		}),
	},
} satisfies Dictionary;

export default auth;
