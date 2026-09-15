import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const domain = {
    // oxlint-disable-next-line sort-keys -- the `dates.month.N` keys run in calendar order; sorting them alphabetically puts month 10 before month 9
    content: {
        "appIcon.default.detail": t({
            en: "The Outlayr mark on paper. The icon the app ships with.",
            es: "La marca de Outlayr sobre papel. El ícono con el que viene la app.",
        }),
        "appIcon.default.detailDev": t({
            en: "The blueprint mark. The icon this development build ships with.",
            es: "La marca en versión plano. El ícono con el que viene esta compilación de desarrollo.",
        }),
        "appIcon.default.label": t({
            en: "Default",
            es: "Predeterminado",
        }),
        "appIcon.emboss.detail": t({
            en: "Paper on paper. The mark reads only in its shadow.",
            es: "Papel sobre papel. La marca solo se lee por su sombra.",
        }),
        "appIcon.emboss.label": t({
            en: "Emboss",
            es: "Relieve",
        }),
        "appIcon.hairline.detail": t({
            en: "Outline only, drawn in a single ink hairline.",
            es: "Solo el contorno, trazado en una línea de tinta.",
        }),
        "appIcon.hairline.label": t({
            en: "Hairline",
            es: "Contorno",
        }),
        "appIcon.ink.detail": t({
            en: "The mark inverted — paper on ink, for darker home screens.",
            es: "La marca invertida — papel sobre tinta, para pantallas más oscuras.",
        }),
        "appIcon.ink.label": t({
            en: "Ink",
            es: "Tinta",
        }),
        "appIcon.mono.detail": t({
            en: "A flat grey field with the ink mark. Quiet and neutral.",
            es: "Un campo gris plano con la marca en tinta. Discreto y neutral.",
        }),
        "appIcon.mono.label": t({
            en: "Mono",
            es: "Mono",
        }),
        "budgetTime.daysLeft": t({
            en: "{count}d left",
            es: "quedan {count}d",
        }),
        "budgetTime.hoursLeft": t({
            en: "{count}h left",
            es: "quedan {count}h",
        }),
        "clock.deviceNote": t({
            en: "Starts on whatever your device uses; changing it here takes over.",
            es: "Empieza con lo que usa tu dispositivo; cambiarlo aquí toma el control.",
        }),
        // A full date is the one form where the order itself is localized, so the
        // template carries it rather than the formatter branching per language.
        "clock.section": t({
            en: "Clock",
            es: "Reloj",
        }),
        "clock.twelveHour": t({
            en: "12-hour",
            es: "12 horas",
        }),
        "clock.twentyFourHour": t({
            en: "24-hour",
            es: "24 horas",
        }),
        "coverage.pending": t({
            en: "Rates are still catching up: {count} of {total} entries are counted at the amount they were logged in.",
            es: "Las tasas se están actualizando: {count} de {total} registros se cuentan con el monto con el que se registraron.",
        }),
        "coverage.pendingAndPredate": t({
            en: "Rates are still catching up: {count} of {total} entries are counted at the amount they were logged in. {predate} more predate the rate history and always will be.",
            es: "Las tasas se están actualizando: {count} de {total} registros se cuentan con el monto con el que se registraron. Otros {predate} son anteriores al historial de tasas y siempre lo serán.",
        }),
        "coverage.predateOnly": t({
            en: "{count} of {total} entries predate the rate history, so they are counted at the amount they were logged in.",
            es: "{count} de {total} registros son anteriores al historial de tasas, así que se cuentan con el monto con el que se registraron.",
        }),
        "dates.meridiem.am": t({ en: "AM", es: "a. m." }),
        "dates.meridiem.pm": t({ en: "PM", es: "p. m." }),
        // Indexed by `Date.getMonth()` / `Date.getDay()`, so the order is the
        // platform's and not a reading order. Spanish keeps months and weekdays
        // lowercase, which is its own convention rather than an untranslated string;
        // the shouted forms the Log and Insights use are upper-cased at the call
        // site so only one set of names has to stay in step per form.
        "dates.month.0": t({ en: "Jan", es: "ene" }),
        "dates.month.1": t({ en: "Feb", es: "feb" }),
        "dates.month.2": t({ en: "Mar", es: "mar" }),
        "dates.month.3": t({ en: "Apr", es: "abr" }),
        "dates.month.4": t({ en: "May", es: "may" }),
        "dates.month.5": t({ en: "Jun", es: "jun" }),
        "dates.month.6": t({ en: "Jul", es: "jul" }),
        "dates.month.7": t({ en: "Aug", es: "ago" }),
        "dates.month.8": t({ en: "Sep", es: "sep" }),
        "dates.month.9": t({ en: "Oct", es: "oct" }),
        "dates.month.10": t({ en: "Nov", es: "nov" }),
        "dates.month.11": t({ en: "Dec", es: "dic" }),
        "dates.monthLong.0": t({ en: "January", es: "enero" }),
        "dates.monthLong.1": t({ en: "February", es: "febrero" }),
        "dates.monthLong.2": t({ en: "March", es: "marzo" }),
        "dates.monthLong.3": t({ en: "April", es: "abril" }),
        "dates.monthLong.4": t({ en: "May", es: "mayo" }),
        "dates.monthLong.5": t({ en: "June", es: "junio" }),
        "dates.monthLong.6": t({ en: "July", es: "julio" }),
        "dates.monthLong.7": t({ en: "August", es: "agosto" }),
        "dates.monthLong.8": t({ en: "September", es: "septiembre" }),
        "dates.monthLong.9": t({ en: "October", es: "octubre" }),
        "dates.monthLong.10": t({ en: "November", es: "noviembre" }),
        "dates.monthLong.11": t({ en: "December", es: "diciembre" }),
        "dates.weekday.0": t({ en: "Sun", es: "dom" }),
        "dates.weekday.1": t({ en: "Mon", es: "lun" }),
        "dates.weekday.2": t({ en: "Tue", es: "mar" }),
        "dates.weekday.3": t({ en: "Wed", es: "mié" }),
        "dates.weekday.4": t({ en: "Thu", es: "jue" }),
        "dates.weekday.5": t({ en: "Fri", es: "vie" }),
        "dates.weekday.6": t({ en: "Sat", es: "sáb" }),
        // Spanish uses X for miércoles so it does not collide with martes, which is
        // why these are their own set rather than the first letter of the abbrev.
        "dates.weekdayInitial.0": t({ en: "S", es: "D" }),
        "dates.weekdayInitial.1": t({ en: "M", es: "L" }),
        "dates.weekdayInitial.2": t({ en: "T", es: "M" }),
        "dates.weekdayInitial.3": t({ en: "W", es: "X" }),
        "dates.weekdayInitial.4": t({ en: "T", es: "J" }),
        "dates.weekdayInitial.5": t({ en: "F", es: "V" }),
        "dates.weekdayInitial.6": t({ en: "S", es: "S" }),
        "daySlots.over_one": t({
            en: "One {noun} too many.",
            es: "Un {noun} de más.",
        }),
        "daySlots.over_other": t({
            en: "{count} {noun} too many.",
            es: "{count} {noun} de más.",
        }),
        "daySlots.room": t({
            en: "Room for one more.",
            es: "Alcanza para uno más.",
        }),
        "daySlots.tight": t({
            en: "Not enough for another.",
            es: "No alcanza para otro.",
        }),
        "icons.section.food": t({
            en: "Food & Drink",
            es: "Comida y bebida",
        }),
        "icons.section.health": t({
            en: "Health & Fitness",
            es: "Salud y bienestar",
        }),
        "icons.section.home": t({
            en: "Home & Utilities",
            es: "Hogar y servicios",
        }),
        "icons.section.leisure": t({
            en: "Leisure",
            es: "Ocio",
        }),
        "icons.section.life": t({
            en: "Life & Other",
            es: "Vida y otros",
        }),
        "icons.section.money": t({
            en: "Money & Work",
            es: "Dinero y trabajo",
        }),
        "icons.section.shopping": t({
            en: "Shopping",
            es: "Compras",
        }),
        "icons.section.transport": t({
            en: "Transport & Travel",
            es: "Transporte y viajes",
        }),
        "lock.failed": t({
            en: "That did not match. Try again.",
            es: "No coincidió. Inténtalo de nuevo.",
        }),
        "lock.fallback": t({
            en: "Choose Unlock again to enter your device passcode.",
            es: "Elige Desbloquear otra vez para escribir el código de tu dispositivo.",
        }),
        "lock.lockout": t({
            en: "Too many attempts. Unlock with your device passcode instead.",
            es: "Demasiados intentos. Desbloquea con el código de tu dispositivo.",
        }),
        "lock.timeout": t({
            en: "The prompt timed out. Try again.",
            es: "La solicitud expiró. Inténtalo de nuevo.",
        }),
        "lock.unavailable": t({
            en: "This device has no passcode or biometrics set up.",
            es: "Este dispositivo no tiene código ni biometría configurados.",
        }),
        "lock.unknown": t({
            en: "Could not check. Try again.",
            es: "No se pudo verificar. Inténtalo de nuevo.",
        }),
        "verdict.inLine": t({
            en: "In line with {prior}.",
            es: "En línea con {prior}.",
        }),
        "verdict.lessThan": t({
            en: "{amount} less than {prior}.",
            es: "{amount} menos que {prior}.",
        }),
        "verdict.moreThan": t({
            en: "{amount} more than {prior}.",
            es: "{amount} más que {prior}.",
        }),
        "verdict.moverAdded": t({
            en: "{name} alone added {amount}.",
            es: "Solo {name} sumó {amount}.",
        }),
        "verdict.moverGaveBack": t({
            en: "{name} alone gave back {amount}.",
            es: "Solo {name} devolvió {amount}.",
        }),
    },
    key: "domain" as const,
} satisfies Dictionary;

export default domain;
