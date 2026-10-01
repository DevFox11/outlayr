import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const transfers = {
    content: {
        "transfers.a11y.balance": t({
            en: "{account}, {balance}",
            es: "{account}, {balance}",
        }),
        "transfers.a11y.balanceChange": t({
            en: "{account}, {before}, then {after}",
            es: "{account}, {before}, luego {after}",
        }),
        "transfers.a11y.missing": t({
            en: "Missing: {field}",
            es: "Falta: {field}",
        }),
        "transfers.a11y.new": t({
            en: "New transfer",
            es: "Nueva transferencia",
        }),
        "transfers.block.feeOverArrival": t({
            en: "The fee is {amount} more than arrives",
            es: "La comisión supera por {amount} lo que llega",
        }),
        "transfers.block.nothingArrives": t({
            en: "Nothing would arrive. The fee takes it all.",
            es: "No llegaría nada: la comisión se lo lleva todo.",
        }),
        "transfers.delete.row": t({
            en: "Delete Transfer",
            es: "Eliminar transferencia",
        }),
        "transfers.fee.chargedTo": t({
            en: "Charged to",
            es: "Se cobra en",
        }),
        "transfers.fee.included": t({
            en: "Included",
            es: "Incluida",
        }),
        "transfers.fee.note": t({
            en: "Fee · {from} → {to}",
            es: "Comisión · {from} → {to}",
        }),
        "transfers.fee.onTop": t({
            en: "On top",
            es: "Aparte",
        }),
        "transfers.field.arrives": t({
            en: "Arrives",
            es: "Llega",
        }),
        "transfers.field.date": t({
            en: "Date",
            es: "Fecha",
        }),
        "transfers.field.fee": t({
            en: "Fee",
            es: "Comisión",
        }),
        "transfers.field.feeSide": t({
            en: "Fee charged to",
            es: "Comisión cobrada a",
        }),
        "transfers.field.from": t({
            en: "From",
            es: "Desde",
        }),
        "transfers.field.note": t({
            en: "Note",
            es: "Nota",
        }),
        "transfers.field.outside": t({
            en: "From another account",
            es: "De otra cuenta",
        }),
        "transfers.field.rate": t({
            en: "Rate",
            es: "Tasa",
        }),
        "transfers.field.rateType": t({
            en: "Rate source",
            es: "Fuente de la tasa",
        }),
        "transfers.field.sent": t({
            en: "You send",
            es: "Envías",
        }),
        "transfers.field.to": t({
            en: "To",
            es: "Hacia",
        }),
        "transfers.gap.itsAFee": t({
            en: "It's a fee",
            es: "Es una comisión",
        }),
        "transfers.gap.itsOnTop": t({
            en: "It's on top",
            es: "Es aparte",
        }),
        "transfers.gap.less": t({
            en: "{amount} less arrived",
            es: "Llegaron {amount} de menos",
        }),
        "transfers.gap.more": t({
            en: "{amount} more arrived",
            es: "Llegaron {amount} de más",
        }),
        "transfers.gap.outside": t({
            en: "It came from another account",
            es: "Salió de otra cuenta",
        }),
        "transfers.rate.lastUsed": t({
            en: "Last used · {date}",
            es: "Última · {date}",
        }),
        "transfers.rate.unavailable": t({
            en: "No rate for this pair. Enter one.",
            es: "No hay tasa para este par. Ingresa una.",
        }),
        "transfers.save": t({
            en: "Save Transfer",
            es: "Guardar transferencia",
        }),
        "transfers.save.failed": t({
            en: "Couldn't save this transfer. Try again.",
            es: "No se pudo guardar la transferencia. Inténtalo de nuevo.",
        }),
        "transfers.saved.another": t({
            en: "Add another",
            es: "Agregar otra",
        }),
        "transfers.saved.from": t({
            en: "From {from}",
            es: "Desde {from}",
        }),
        "transfers.saved.title": t({
            en: "Transfer added",
            es: "Transferencia agregada",
        }),
        "transfers.sentence.blank.account": t({
            en: "an account",
            es: "una cuenta",
        }),
        "transfers.sentence.blank.amount": t({
            en: "an amount",
            es: "un monto",
        }),
        "transfers.sentence.blank.noFee": t({
            en: "No fee",
            es: "Sin comisión",
        }),
        "transfers.sentence.blank.rate": t({
            en: "a rate",
            es: "una tasa",
        }),
        "transfers.sentence.fee": t({
            en: "A {fee} fee from {feeSide}.",
            es: "Comisión de {fee} desde {feeSide}.",
        }),
        "transfers.sentence.feeArrives": t({
            en: "After a {fee} fee from {feeSide}, {arrives} arrives.",
            es: "Tras una comisión de {fee} desde {feeSide}, llegan {arrives}.",
        }),
        "transfers.sentence.feeOnTop": t({
            en: "Plus a {fee} fee from {feeSide}.",
            es: "Más una comisión de {fee} desde {feeSide}.",
        }),
        "transfers.sentence.move": t({
            en: "Move {amount} from {from} to {to} {when}.",
            es: "Mueve {amount} de {from} a {to} {when}.",
        }),
        "transfers.sentence.noFee": t({
            en: "{fee}.",
            es: "{fee}.",
        }),
        "transfers.sentence.outside": t({
            en: "Includes {outside} from another account.",
            es: "Incluye {outside} de otra cuenta.",
        }),
        "transfers.sentence.rate": t({
            en: "At the {rateType} rate, {rate}, it arrives as {arrives}.",
            es: "A la tasa {rateType}, {rate}, llega como {arrives}.",
        }),
        "transfers.sentence.rateCustom": t({
            en: "At {rateType} rate, {rate}, it arrives as {arrives}.",
            es: "A {rateType}, {rate}, llega como {arrives}.",
        }),
        "transfers.title": t({
            en: "Transfer",
            es: "Transferencia",
        }),
    },
    key: "transfers" as const,
} satisfies Dictionary;

export default transfers;
