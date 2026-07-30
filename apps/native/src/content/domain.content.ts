import { type Dictionary, t } from "intlayer";

const domain = {
	key: "domain" as const,
	content: {
		"icons.section.food": t({
			en: "Food & Drink",
			es: "Comida y bebida",
		}),
		"icons.section.shopping": t({
			en: "Shopping",
			es: "Compras",
		}),
		"icons.section.transport": t({
			en: "Transport & Travel",
			es: "Transporte y viajes",
		}),
		"icons.section.home": t({
			en: "Home & Utilities",
			es: "Hogar y servicios",
		}),
		"icons.section.health": t({
			en: "Health & Fitness",
			es: "Salud y bienestar",
		}),
		"icons.section.leisure": t({
			en: "Leisure",
			es: "Ocio",
		}),
		"icons.section.money": t({
			en: "Money & Work",
			es: "Dinero y trabajo",
		}),
		"icons.section.life": t({
			en: "Life & Other",
			es: "Vida y otros",
		}),
		"verdict.inLine": t({
			en: "In line with {prior}.",
			es: "En línea con {prior}.",
		}),
		"verdict.moreThan": t({
			en: "{amount} more than {prior}.",
			es: "{amount} más que {prior}.",
		}),
		"verdict.lessThan": t({
			en: "{amount} less than {prior}.",
			es: "{amount} menos que {prior}.",
		}),
		"verdict.moverAdded": t({
			en: "{name} alone added {amount}.",
			es: "Solo {name} sumó {amount}.",
		}),
		"verdict.moverGaveBack": t({
			en: "{name} alone gave back {amount}.",
			es: "Solo {name} devolvió {amount}.",
		}),
		"daySlots.room": t({
			en: "Room for one more.",
			es: "Alcanza para uno más.",
		}),
		"daySlots.tight": t({
			en: "Not enough for another.",
			es: "No alcanza para otro.",
		}),
		"daySlots.over_one": t({
			en: "One {noun} too many.",
			es: "Un {noun} de más.",
		}),
		"daySlots.over_other": t({
			en: "{count} {noun} too many.",
			es: "{count} {noun} de más.",
		}),
		"daySlots.purchase": t({
			en: "purchase",
			es: "compra",
		}),
		"budgetTime.hoursLeft": t({
			en: "{count}h left",
			es: "quedan {count}h",
		}),
		"budgetTime.daysLeft": t({
			en: "{count}d left",
			es: "quedan {count}d",
		}),
		"coverage.predateOnly": t({
			en: "{count} of {total} entries predate the rate history, so they are counted at the amount they were logged in.",
			es: "{count} de {total} registros son anteriores al historial de tasas, así que se cuentan con el monto con el que se registraron.",
		}),
		"coverage.pending": t({
			en: "Rates are still catching up: {count} of {total} entries are counted at the amount they were logged in.",
			es: "Las tasas se están actualizando: {count} de {total} registros se cuentan con el monto con el que se registraron.",
		}),
		"coverage.pendingAndPredate": t({
			en: "Rates are still catching up: {count} of {total} entries are counted at the amount they were logged in. {predate} more predate the rate history and always will be.",
			es: "Las tasas se están actualizando: {count} de {total} registros se cuentan con el monto con el que se registraron. Otros {predate} son anteriores al historial de tasas y siempre lo serán.",
		}),
		"lock.lockout": t({
			en: "Too many attempts. Unlock with your device passcode instead.",
			es: "Demasiados intentos. Desbloquea con el código de tu dispositivo.",
		}),
		"lock.failed": t({
			en: "That did not match. Try again.",
			es: "No coincidió. Inténtalo de nuevo.",
		}),
		"lock.fallback": t({
			en: "Choose Unlock again to enter your device passcode.",
			es: "Elige Desbloquear otra vez para escribir el código de tu dispositivo.",
		}),
		"lock.unavailable": t({
			en: "This device has no passcode or biometrics set up.",
			es: "Este dispositivo no tiene código ni biometría configurados.",
		}),
		"lock.timeout": t({
			en: "The prompt timed out. Try again.",
			es: "La solicitud expiró. Inténtalo de nuevo.",
		}),
		"lock.unknown": t({
			en: "Could not check. Try again.",
			es: "No se pudo verificar. Inténtalo de nuevo.",
		}),
		"appIcon.default.label": t({
			en: "Default",
			es: "Predeterminado",
		}),
		"appIcon.default.detail": t({
			en: "The Outlayr mark on paper. The icon the app ships with.",
			es: "La marca de Outlayr sobre papel. El ícono con el que viene la app.",
		}),
		"appIcon.default.detailDev": t({
			en: "The blueprint mark. The icon this development build ships with.",
			es: "La marca en versión plano. El ícono con el que viene esta compilación de desarrollo.",
		}),
		"appIcon.ink.label": t({
			en: "Ink",
			es: "Tinta",
		}),
		"appIcon.ink.detail": t({
			en: "The mark inverted — paper on ink, for darker home screens.",
			es: "La marca invertida — papel sobre tinta, para pantallas más oscuras.",
		}),
		"appIcon.hairline.label": t({
			en: "Hairline",
			es: "Contorno",
		}),
		"appIcon.hairline.detail": t({
			en: "Outline only, drawn in a single ink hairline.",
			es: "Solo el contorno, trazado en una línea de tinta.",
		}),
		"appIcon.mono.label": t({
			en: "Mono",
			es: "Mono",
		}),
		"appIcon.mono.detail": t({
			en: "A flat grey field with the ink mark. Quiet and neutral.",
			es: "Un campo gris plano con la marca en tinta. Discreto y neutral.",
		}),
		"appIcon.emboss.label": t({
			en: "Emboss",
			es: "Relieve",
		}),
		"appIcon.emboss.detail": t({
			en: "Paper on paper. The mark reads only in its shadow.",
			es: "Papel sobre papel. La marca solo se lee por su sombra.",
		}),
	},
} satisfies Dictionary;

export default domain;
