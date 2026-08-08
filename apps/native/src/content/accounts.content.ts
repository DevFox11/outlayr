import { type Dictionary, t } from "intlayer";

const accounts = {
	key: "accounts" as const,
	content: {
		"accounts.title": t({
			en: "Accounts",
			es: "Cuentas",
		}),
		"accounts.reorderTitle": t({
			en: "Reorder Accounts",
			es: "Reordenar cuentas",
		}),
		"accounts.nav.new": t({
			en: "New Account",
			es: "Nueva cuenta",
		}),
		"accounts.nav.edit": t({
			en: "Edit Account",
			es: "Editar cuenta",
		}),
		"accounts.a11y.new": t({
			en: "New account",
			es: "Nueva cuenta",
		}),
		"accounts.a11y.reorder": t({
			en: "Reorder accounts",
			es: "Reordenar cuentas",
		}),
		"accounts.a11y.edit": t({
			en: "Edit account",
			es: "Editar cuenta",
		}),
		"accounts.census_one": t({
			en: "{count} account",
			es: "{count} cuenta",
		}),
		"accounts.census_other": t({
			en: "{count} accounts",
			es: "{count} cuentas",
		}),
		"accounts.empty": t({
			en: "Money lives in places. Give yours its first one.",
			es: "El dinero vive en lugares. Dale a tu dinero el primero.",
		}),
		"accounts.multiCurrency": t({
			en: "Multi-currency",
			es: "Multimoneda",
		}),
		"accounts.field.name": t({
			en: "Name",
			es: "Nombre",
		}),
		"accounts.namePlaceholder": t({
			en: "Chase, Cash, Nubank…",
			es: "Chase, Efectivo, Nubank…",
		}),
		"accounts.field.currency": t({
			en: "Currency",
			es: "Moneda",
		}),
		"accounts.field.initialBalance": t({
			en: "Initial balance",
			es: "Saldo inicial",
		}),
		"accounts.a11y.balanceSign": t({
			en: "Toggle balance sign",
			es: "Cambiar el signo del saldo",
		}),
		"accounts.a11y.editBalance": t({
			en: "Edit initial balance",
			es: "Editar el saldo inicial",
		}),
		"accounts.rebaseNote": t({
			en: "Changing the initial balance or currency re-bases this account's balance.",
			es: "Cambiar el saldo inicial o la moneda recalcula la base del saldo de esta cuenta.",
		}),
		"accounts.addAccount": t({
			en: "Add Account",
			es: "Agregar cuenta",
		}),
		"accounts.saveAccount": t({
			en: "Save Account",
			es: "Guardar cuenta",
		}),
		"accounts.delete.row": t({
			en: "Delete Account",
			es: "Eliminar cuenta",
		}),
		"accounts.delete.title": t({
			en: "Delete ‘{name}’?",
			es: "¿Eliminar ‘{name}’?",
		}),
		"accounts.delete.message": t({
			en: "Its transactions are kept — they just stop belonging to an account.",
			es: "Sus transacciones se conservan; solo dejan de pertenecer a una cuenta.",
		}),
		"accounts.error.addTitle": t({
			en: "Couldn't Add Account",
			es: "No se pudo agregar la cuenta",
		}),
		"accounts.error.saveTitle": t({
			en: "Couldn't Save Account",
			es: "No se pudo guardar la cuenta",
		}),
		"accounts.error.generic": t({
			en: "Something went wrong. Please try again.",
			es: "Algo salió mal. Inténtalo de nuevo.",
		}),
		"accounts.detail.startedAt": t({
			en: "Started at {amount} · {month}",
			es: "Comenzó en {amount} · {month}",
		}),
		"accounts.detail.empty": t({
			en: "Nothing attached yet — this account's transactions will gather here.",
			es: "Aún no hay nada adjunto: las transacciones de esta cuenta se reunirán aquí.",
		}),
		"accounts.overview.heading": t({
			en: "Accounts",
			es: "Cuentas",
		}),
	},
} satisfies Dictionary;

export default accounts;
