import { type Dictionary, t } from "intlayer";

const transfers = {
	content: {
		"transfers.a11y.editAmount": t({
			en: "Edit amount",
			es: "Editar el monto",
		}),
		"transfers.a11y.editArrival": t({
			en: "Edit the amount that arrived",
			es: "Editar el monto que llegó",
		}),
		"transfers.a11y.editRate": t({
			en: "Edit the exchange rate",
			es: "Editar la tasa de cambio",
		}),
		"transfers.a11y.new": t({
			en: "New transfer",
			es: "Nueva transferencia",
		}),
		"transfers.a11y.swap": t({
			en: "Swap direction",
			es: "Invertir la dirección",
		}),
		"transfers.arrives": t({
			en: "arrives as {amount}",
			es: "llegan como {amount}",
		}),
		"transfers.field.date": t({
			en: "Date",
			es: "Fecha",
		}),
		"transfers.field.from": t({
			en: "From",
			es: "Desde",
		}),
		"transfers.field.note": t({
			en: "Note",
			es: "Nota",
		}),
		"transfers.field.rate": t({
			en: "Rate",
			es: "Tasa",
		}),
		"transfers.field.to": t({
			en: "To",
			es: "Hacia",
		}),
		"transfers.needTwoAccounts": t({
			en: "Transfers need two accounts. Add another one first.",
			es: "Las transferencias necesitan dos cuentas. Agregá otra primero.",
		}),
		"transfers.notePlaceholder": t({
			en: "Optional",
			es: "Opcional",
		}),
		"transfers.rate.custom": t({
			en: "Custom",
			es: "Personalizada",
		}),
		"transfers.rate.eur_reference": t({
			en: "EUR ref",
			es: "Ref. EUR",
		}),
		"transfers.rate.lastUsed": t({
			en: "Last used {date}",
			es: "Usada por última vez el {date}",
		}),
		"transfers.rate.official": t({
			en: "Official",
			es: "Oficial",
		}),
		"transfers.rate.perUnit": t({
			en: "{quote} per {base}",
			es: "{quote} por {base}",
		}),
		"transfers.rate.unavailable": t({
			en: "No rate for this pair — enter one",
			es: "Sin tasa para este par: ingresá una",
		}),
		"transfers.save": t({
			en: "Save Transfer",
			es: "Guardar transferencia",
		}),
		"transfers.selectAccount": t({
			en: "Choose",
			es: "Elegir",
		}),
		"transfers.title": t({
			en: "Transfer",
			es: "Transferencia",
		}),
	},
	key: "transfers" as const,
} satisfies Dictionary;

export default transfers;
