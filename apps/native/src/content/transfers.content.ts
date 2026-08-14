import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const transfers = {
    content: {
        "transfers.a11y.editArrival": t({
            en: "Edit the amount that arrived",
            es: "Editar el monto que llegó",
        }),
        "transfers.a11y.new": t({
            en: "New transfer",
            es: "Nueva transferencia",
        }),
        "transfers.a11y.swap": t({
            en: "Swap direction",
            es: "Invertir la dirección",
        }),
        "transfers.addFee": t({
            en: "Add fee",
            es: "Agregar comisión",
        }),
        "transfers.arrives": t({
            en: "arrives as {amount}",
            es: "llegan como {amount}",
        }),
        "transfers.block.feeOverArrival": t({
            en: "The fee is {amount} more than arrives",
            es: "La comisión es {amount} más de lo que llega",
        }),
        "transfers.block.nothingArrives": t({
            en: "Nothing would arrive — the fee takes it all",
            es: "No llegaría nada: la comisión se lo lleva todo",
        }),
        "transfers.delete.confirm": t({
            en: "Delete",
            es: "Eliminar",
        }),
        "transfers.delete.message": t({
            en: "Both balances go back to what they were. Its fee, if it had one, goes with it.",
            es: "Ambos saldos vuelven a lo que eran. Su comisión, si tenía, se va con ella.",
        }),
        "transfers.delete.row": t({
            en: "Delete Transfer",
            es: "Eliminar transferencia",
        }),
        "transfers.delete.title": t({
            en: "Delete this transfer?",
            es: "¿Eliminar esta transferencia?",
        }),
        "transfers.detail.arrived": t({
            en: "Arrived",
            es: "Llegó",
        }),
        "transfers.detail.feeNote": t({
            en: "Counted as spending, unlike the transfer itself.",
            es: "Cuenta como gasto, a diferencia de la transferencia.",
        }),
        "transfers.detail.left": t({
            en: "Left",
            es: "Salió",
        }),
        "transfers.detail.rateSource": t({
            en: "Source",
            es: "Fuente",
        }),
        "transfers.fee.destination": t({
            en: "Charged on arrival",
            es: "Cobrada al llegar",
        }),
        "transfers.fee.note": t({
            en: "Fee · {from} → {to}",
            es: "Comisión · {from} → {to}",
        }),
        "transfers.fee.source": t({
            en: "Charged by sender",
            es: "Cobrada al enviar",
        }),
        "transfers.field.date": t({
            en: "Date",
            es: "Fecha",
        }),
        "transfers.field.fee": t({
            en: "Fee",
            es: "Comisión",
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
        "transfers.gap.itsAFee": t({
            en: "It's a fee",
            es: "Es una comisión",
        }),
        "transfers.gap.rateWas": t({
            en: "Rate was {rate}",
            es: "La tasa era {rate}",
        }),
        "transfers.gap.unaccounted": t({
            en: "{amount} unaccounted",
            es: "{amount} sin explicar",
        }),
        "transfers.movement": t({
            en: "The movement",
            es: "El movimiento",
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
