import { type Dictionary, t } from "intlayer";

const accounts = {
	content: {
		"accounts.a11y.balanceSign": t({
			en: "Toggle balance sign",
			es: "Cambiar el signo del saldo",
		}),
		"accounts.a11y.edit": t({
			en: "Edit account",
			es: "Editar cuenta",
		}),
		"accounts.a11y.editBalance": t({
			en: "Edit initial balance",
			es: "Editar el saldo inicial",
		}),
		"accounts.a11y.new": t({
			en: "New account",
			es: "Nueva cuenta",
		}),
		"accounts.a11y.reorder": t({
			en: "Reorder accounts",
			es: "Reordenar cuentas",
		}),
		"accounts.addAccount": t({
			en: "Add Account",
			es: "Agregar cuenta",
		}),
		"accounts.census_one": t({
			en: "{count} account",
			es: "{count} cuenta",
		}),
		"accounts.census_other": t({
			en: "{count} accounts",
			es: "{count} cuentas",
		}),
		"accounts.delete.message": t({
			en: "Its transactions are kept — they just stop belonging to an account.",
			es: "Sus transacciones se conservan; solo dejan de pertenecer a una cuenta.",
		}),
		"accounts.delete.row": t({
			en: "Delete Account",
			es: "Eliminar cuenta",
		}),
		"accounts.delete.title": t({
			en: "Delete ‘{name}’?",
			es: "¿Eliminar ‘{name}’?",
		}),
		"accounts.detail.empty": t({
			en: "Nothing attached yet — this account's transactions will gather here.",
			es: "Aún no hay nada adjunto: las transacciones de esta cuenta se reunirán aquí.",
		}),
		"accounts.detail.startedAt": t({
			en: "Started at {amount} · {month}",
			es: "Comenzó en {amount} · {month}",
		}),
		"accounts.empty": t({
			en: "Money lives in places. Give yours its first one.",
			es: "El dinero vive en lugares. Dale a tu dinero el primero.",
		}),
		"accounts.error.addTitle": t({
			en: "Couldn't Add Account",
			es: "No se pudo agregar la cuenta",
		}),
		"accounts.error.deleteTitle": t({
			en: "Couldn't Delete Account",
			es: "No se pudo eliminar la cuenta",
		}),
		"accounts.error.generic": t({
			en: "Something went wrong. Please try again.",
			es: "Algo salió mal. Inténtalo de nuevo.",
		}),
		"accounts.error.saveTitle": t({
			en: "Couldn't Save Account",
			es: "No se pudo guardar la cuenta",
		}),
		"accounts.field.currency": t({
			en: "Currency",
			es: "Moneda",
		}),
		"accounts.field.initialBalance": t({
			en: "Initial balance",
			es: "Saldo inicial",
		}),
		"accounts.field.name": t({
			en: "Name",
			es: "Nombre",
		}),
		"accounts.multiCurrency": t({
			en: "Multi-currency",
			es: "Multimoneda",
		}),
		"accounts.namePlaceholder": t({
			en: "Chase, Cash, Nubank…",
			es: "Chase, Efectivo, Nubank…",
		}),
		"accounts.nav.edit": t({
			en: "Edit Account",
			es: "Editar cuenta",
		}),
		"accounts.nav.new": t({
			en: "New Account",
			es: "Nueva cuenta",
		}),
		"accounts.overview.heading": t({
			en: "Accounts",
			es: "Cuentas",
		}),
		"accounts.rebaseNote": t({
			en: "Changing the initial balance or currency re-bases this account's balance.",
			es: "Cambiar el saldo inicial o la moneda recalcula la base del saldo de esta cuenta.",
		}),
		"accounts.reorderTitle": t({
			en: "Reorder Accounts",
			es: "Reordenar cuentas",
		}),
		"accounts.saveAccount": t({
			en: "Save Account",
			es: "Guardar cuenta",
		}),
		"accounts.title": t({
			en: "Accounts",
			es: "Cuentas",
		}),
	},
	key: "accounts" as const,
} satisfies Dictionary;

export default accounts;
