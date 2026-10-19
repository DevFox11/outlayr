import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const debts = {
    content: {
        "debts.a11y.add": t({
            en: "Add a debt",
            es: "Agregar una deuda",
        }),
        "debts.a11y.amount": t({
            en: "Edit amount",
            es: "Editar el monto",
        }),
        "debts.a11y.more": t({
            en: "More",
            es: "Más",
        }),
        "debts.action.borrow": t({
            en: "Borrow",
            es: "Pedir prestado",
        }),
        "debts.action.borrowMore": t({
            en: "Borrow more",
            es: "Pedir más",
        }),
        "debts.action.gotPaidBack": t({
            en: "Got paid back",
            es: "Me pagó",
        }),
        "debts.action.lend": t({
            en: "Lend",
            es: "Prestar",
        }),
        "debts.action.lendMore": t({
            en: "Lend more",
            es: "Prestar más",
        }),
        "debts.action.payBack": t({
            en: "Pay back",
            es: "Pagar",
        }),
        "debts.add.liability": t({
            en: "A company, card or loan",
            es: "Una empresa, tarjeta o préstamo",
        }),
        "debts.add.person": t({
            en: "A person",
            es: "Una persona",
        }),
        "debts.due.overdue_one": t({
            en: "{count} payment · {name} overdue since {date}",
            es: "{count} pago · {name} con atraso desde el {date}",
        }),
        "debts.due.overdue_other": t({
            en: "{count} payments · {name} overdue since {date}",
            es: "{count} pagos · {name} con atraso desde el {date}",
        }),
        "debts.due.summary_one": t({
            en: "{count} payment · next {name}, {date}",
            es: "{count} pago · próximo {name}, {date}",
        }),
        "debts.due.summary_other": t({
            en: "{count} payments · next {name}, {date}",
            es: "{count} pagos · próximo {name}, {date}",
        }),
        "debts.due.title": t({
            en: "Due in the next {days} days",
            es: "Por pagar en los próximos {days} días",
        }),
        "debts.empty": t({
            en: "Nobody owes anybody. Add a person, a card or a loan with +.",
            es: "Nadie le debe a nadie. Agrega una persona, tarjeta o préstamo con +.",
        }),
        "debts.error.saveFailed": t({
            en: "Couldn't save this debt. Try again.",
            es: "No se pudo guardar la deuda. Inténtalo de nuevo.",
        }),
        "debts.field.accountFrom": t({
            en: "From",
            es: "Desde",
        }),
        "debts.field.accountInto": t({
            en: "Into",
            es: "En",
        }),
        "debts.field.before": t({
            en: "None, it was before Outlayr",
            es: "Ninguna, fue antes de Outlayr",
        }),
        "debts.field.currency": t({
            en: "Currency",
            es: "Moneda",
        }),
        "debts.field.date": t({
            en: "Date",
            es: "Fecha",
        }),
        "debts.field.note": t({
            en: "Note",
            es: "Nota",
        }),
        "debts.field.notePlaceholder": t({
            en: "Optional",
            es: "Opcional",
        }),
        "debts.field.personFrom": t({
            en: "From",
            es: "De",
        }),
        "debts.field.personPlaceholder": t({
            en: "Name",
            es: "Nombre",
        }),
        "debts.field.personTo": t({
            en: "To",
            es: "Para",
        }),
        "debts.field.theirSide": t({
            en: "In {currency}",
            es: "En {currency}",
        }),
        "debts.new.title": t({
            en: "New Debt",
            es: "Nueva deuda",
        }),
        "debts.next.of": t({
            en: "Next {amount} · {date} · {paid} of {total}",
            es: "Próxima {amount} · {date} · {paid} de {total}",
        }),
        "debts.next.orders": t({
            en: "Next {amount} · {date} · {count} orders",
            es: "Próxima {amount} · {date} · {count} órdenes",
        }),
        "debts.overdue.of": t({
            en: "{amount} · {date} · {paid} of {total}",
            es: "{amount} · {date} · {paid} de {total}",
        }),
        "debts.overdue.orders": t({
            en: "{amount} · {date} · {count} orders",
            es: "{amount} · {date} · {count} órdenes",
        }),
        "debts.overview.due": t({
            en: "{amount} due in {days} days",
            es: "{amount} por pagar en {days} días",
        }),
        "debts.overview.owedToYou": t({
            en: "Owed to you {amount}",
            es: "Te deben {amount}",
        }),
        "debts.owedToYou": t({
            en: "Owed to you",
            es: "Te deben",
        }),
        "debts.people": t({
            en: "People",
            es: "Personas",
        }),
        "debts.person.deleteBody": t({
            en: "Loans and paybacks with them are deleted too.",
            es: "También se borran los préstamos y pagos con esta persona.",
        }),
        "debts.person.empty": t({
            en: "What moves between you two will gather here.",
            es: "Aquí vas a ver lo que se mueva entre ustedes.",
        }),
        "debts.person.owesYou": t({
            en: "Owes you",
            es: "Te debe",
        }),
        "debts.person.rename": t({
            en: "Rename",
            es: "Cambiar nombre",
        }),
        "debts.person.settled": t({
            en: "Settled",
            es: "Saldado",
        }),
        "debts.person.youOwe": t({
            en: "You owe",
            es: "Le debes",
        }),
        "debts.sale.title": t({
            en: "Sold on credit",
            es: "Venta a crédito",
        }),
        "debts.settled": t({
            en: "Settled · {count}",
            es: "Saldados · {count}",
        }),
        "debts.title": t({
            en: "Debts",
            es: "Deudas",
        }),
        "debts.verb.borrowed": t({
            en: "I borrowed",
            es: "Me prestaron",
        }),
        "debts.verb.lent": t({
            en: "I lent",
            es: "Presté",
        }),
        "debts.verb.soldOnCredit": t({
            en: "Sold on credit",
            es: "Vendí a crédito",
        }),
        "debts.youOwe": t({
            en: "You owe",
            es: "Debes",
        }),
        "debts.youOweAmount": t({
            en: "You owe {amount}",
            es: "Debes {amount}",
        }),
    },
    key: "debts" as const,
} satisfies Dictionary;

export default debts;
