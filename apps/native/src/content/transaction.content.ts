import { type Dictionary, t } from "intlayer";

const transaction = {
	content: {
		"transaction.account.create": t({
			en: "Create Account",
			es: "Crear cuenta",
		}),
		"transaction.account.empty": t({
			en: "No accounts yet. Create one to keep this entry's balance somewhere.",
			es: "Aún no hay cuentas. Crea una para llevar el saldo de esta entrada en algún lugar.",
		}),
		"transaction.account.none": t({
			en: "None",
			es: "Ninguna",
		}),
		"transaction.account.title": t({
			en: "Account",
			es: "Cuenta",
		}),
		"transaction.amount.changeCurrency": t({
			en: "Change currency",
			es: "Cambiar moneda",
		}),
		"transaction.cadence.daily": t({
			en: "Daily",
			es: "Diario",
		}),
		"transaction.cadence.days": t({
			en: "Days",
			es: "Días",
		}),
		"transaction.cadence.monthly": t({
			en: "Monthly",
			es: "Mensual",
		}),
		"transaction.cadence.months": t({
			en: "Months",
			es: "Meses",
		}),
		"transaction.cadence.weekly": t({
			en: "Weekly",
			es: "Semanal",
		}),
		"transaction.cadence.weeks": t({
			en: "Weeks",
			es: "Semanas",
		}),
		"transaction.cadence.yearly": t({
			en: "Yearly",
			es: "Anual",
		}),
		"transaction.cadence.years": t({
			en: "Years",
			es: "Años",
		}),
		"transaction.category.a11yCollapse": t({
			en: "Hide subcategories of {name}",
			es: "Ocultar subcategorías de {name}",
		}),
		"transaction.category.a11yExpand": t({
			en: "Show subcategories of {name}",
			es: "Mostrar subcategorías de {name}",
		}),
		"transaction.category.all": t({
			en: "All categories",
			es: "Todas las categorías",
		}),
		"transaction.category.choose": t({
			en: "Choose",
			es: "Elegir",
		}),
		"transaction.category.createNamed": t({
			en: "Create “{query}”",
			es: "Crear «{query}»",
		}),
		"transaction.category.noMatches": t({
			en: "No category matches “{query}”",
			es: "Ninguna categoría coincide con «{query}»",
		}),
		"transaction.category.recent": t({
			en: "Recent",
			es: "Recientes",
		}),
		"transaction.category.search": t({
			en: "Search categories",
			es: "Buscar categorías",
		}),
		"transaction.category.suggested": t({
			en: "Suggested",
			es: "Sugerida",
		}),
		"transaction.category.willBeCreated": t({
			en: "Will be created",
			es: "Se creará",
		}),
		"transaction.category.willBeCreatedUnder": t({
			en: "Will be created under {parent}",
			es: "Se creará dentro de {parent}",
		}),
		"transaction.cta.add": t({
			en: "Add Transaction",
			es: "Agregar transacción",
		}),
		"transaction.cta.addSubscription": t({
			en: "Add Subscription",
			es: "Agregar suscripción",
		}),
		"transaction.cta.save": t({
			en: "Save Changes",
			es: "Guardar cambios",
		}),
		"transaction.delete.body": t({
			en: "This action cannot be undone.",
			es: "Esta acción no se puede deshacer.",
		}),
		"transaction.delete.title": t({
			en: "Delete transaction?",
			es: "¿Eliminar transacción?",
		}),
		"transaction.edit.title": t({
			en: "Edit Transaction",
			es: "Editar transacción",
		}),
		"transaction.field.account": t({
			en: "Account",
			es: "Cuenta",
		}),
		"transaction.field.amount": t({
			en: "Amount",
			es: "Monto",
		}),
		"transaction.field.category": t({
			en: "Category",
			es: "Categoría",
		}),
		"transaction.field.date": t({
			en: "Date",
			es: "Fecha",
		}),
		"transaction.field.endDate": t({
			en: "End Date",
			es: "Fecha de fin",
		}),
		"transaction.field.ends": t({
			en: "Ends",
			es: "Termina el",
		}),
		"transaction.field.firstPayment": t({
			en: "First Payment",
			es: "Primer pago",
		}),
		"transaction.field.name": t({
			en: "Name",
			es: "Nombre",
		}),
		"transaction.field.namePlaceholder": t({
			en: "Netflix, Groceries…",
			es: "Netflix, Víveres…",
		}),
		"transaction.field.notes": t({
			en: "Notes",
			es: "Notas",
		}),
		"transaction.field.notesPlaceholder": t({
			en: "Optional",
			es: "Opcional",
		}),
		"transaction.field.remind": t({
			en: "Remind Me",
			es: "Recordarme",
		}),
		"transaction.field.schedule": t({
			en: "Schedule",
			es: "Programación",
		}),
		"transaction.field.tags": t({
			en: "Tags",
			es: "Etiquetas",
		}),
		"transaction.field.time": t({
			en: "Time",
			es: "Hora",
		}),
		"transaction.field.type": t({
			en: "Type",
			es: "Tipo",
		}),
		"transaction.identity.autoDetected": t({
			en: "Auto-detected",
			es: "Detectado automáticamente",
		}),
		"transaction.identity.changePhoto": t({
			en: "Change photo",
			es: "Cambiar foto",
		}),
		"transaction.identity.changePhotoPrompt": t({
			en: "Tap to change photo",
			es: "Toca para cambiar la foto",
		}),
		"transaction.identity.color": t({
			en: "Color",
			es: "Color",
		}),
		"transaction.identity.colorUsed": t({
			en: "Already used by another category",
			es: "Ya usada por otra categoría",
		}),
		"transaction.identity.hero.chooseIcon": t({
			en: "Choose an icon & color",
			es: "Elige un ícono y color",
		}),
		"transaction.identity.hero.icon": t({
			en: "Category icon",
			es: "Ícono de categoría",
		}),
		"transaction.identity.hero.iconHint": t({
			en: "Opens the icon picker",
			es: "Abre el selector de íconos",
		}),
		"transaction.identity.hero.logo": t({
			en: "Add a logo or icon",
			es: "Agrega un logo o ícono",
		}),
		"transaction.identity.hero.logoHint": t({
			en: "Opens the logo picker",
			es: "Abre el selector de logos",
		}),
		"transaction.identity.hero.removeIcon": t({
			en: "Remove icon",
			es: "Quitar ícono",
		}),
		"transaction.identity.hero.removeLogo": t({
			en: "Remove logo",
			es: "Quitar logo",
		}),
		"transaction.identity.hero.tapToChange": t({
			en: "Tap to change",
			es: "Toca para cambiar",
		}),
		"transaction.identity.noIcons": t({
			en: "No icons found",
			es: "No se encontraron íconos",
		}),
		"transaction.identity.pickPhotoFirst": t({
			en: "Pick a photo first",
			es: "Primero elige una foto",
		}),
		"transaction.identity.primaryColor": t({
			en: "Primary color from image",
			es: "Color principal de la imagen",
		}),
		"transaction.identity.searchIcons": t({
			en: "Search icons",
			es: "Buscar íconos",
		}),
		"transaction.identity.selectPhoto": t({
			en: "Select photo",
			es: "Seleccionar foto",
		}),
		"transaction.identity.selectPhotoPrompt": t({
			en: "Tap to select a photo",
			es: "Toca para elegir una foto",
		}),
		"transaction.identity.tab.emoji": t({
			en: "Emoji",
			es: "Emoji",
		}),
		"transaction.identity.tab.icons": t({
			en: "Icons",
			es: "Íconos",
		}),
		"transaction.identity.tab.photo": t({
			en: "Photo",
			es: "Foto",
		}),
		"transaction.interval.day": t({
			en: "day",
			es: "día",
		}),
		"transaction.interval.days": t({
			en: "{count} days",
			es: "{count} días",
		}),
		"transaction.interval.month": t({
			en: "month",
			es: "mes",
		}),
		"transaction.interval.months": t({
			en: "{count} months",
			es: "{count} meses",
		}),
		"transaction.interval.week": t({
			en: "week",
			es: "semana",
		}),
		"transaction.interval.weeks": t({
			en: "{count} weeks",
			es: "{count} semanas",
		}),
		"transaction.interval.year": t({
			en: "year",
			es: "año",
		}),
		"transaction.interval.years": t({
			en: "{count} years",
			es: "{count} años",
		}),
		"transaction.kind.once": t({
			en: "One-time",
			es: "Único",
		}),
		"transaction.kind.subscription": t({
			en: "Subscription",
			es: "Suscripción",
		}),
		"transaction.localData.body": t({
			en: "Outlayr could not open your data. This is often temporary — try again first. Your ledger is still on this device.",
			es: "Outlayr no pudo abrir tus datos. Suele ser temporal — inténtalo de nuevo. Tu registro sigue en este dispositivo.",
		}),
		"transaction.localData.retrying": t({
			en: "Trying…",
			es: "Intentando…",
		}),
		"transaction.localData.title": t({
			en: "Something Went Wrong",
			es: "Algo salió mal",
		}),
		"transaction.lock.checking": t({
			en: "Checking…",
			es: "Verificando…",
		}),
		"transaction.lock.prompt": t({
			en: "Unlock Outlayr",
			es: "Desbloquear Outlayr",
		}),
		"transaction.lock.title": t({
			en: "Outlayr is Locked",
			es: "Outlayr está bloqueada",
		}),
		"transaction.lock.unlock": t({
			en: "Unlock",
			es: "Desbloquear",
		}),
		"transaction.new.title": t({
			en: "Create Transaction",
			es: "Crear transacción",
		}),
		"transaction.numpad.delete": t({
			en: "Delete",
			es: "Borrar",
		}),
		"transaction.rate.currentSuggestion": t({
			en: "Current suggestion",
			es: "Sugerencia actual",
		}),
		"transaction.rate.custom": t({
			en: "Custom",
			es: "Personalizada",
		}),
		"transaction.rate.editCustom": t({
			en: "Edit custom rate",
			es: "Editar tasa personalizada",
		}),
		"transaction.rate.eur_reference": t({
			en: "EUR reference",
			es: "Referencia EUR",
		}),
		"transaction.rate.official": t({
			en: "Official",
			es: "Oficial",
		}),
		"transaction.rate.pendingBody": t({
			en: "The native amount remains recorded. Cross-currency totals wait for your confirmation.",
			es: "El monto en su moneda original permanece registrado. Los totales entre monedas esperan tu confirmación.",
		}),
		"transaction.rate.pendingTitle": t({
			en: "Rate confirmation needed",
			es: "Se necesita confirmar la tasa",
		}),
		"transaction.rate.perUsd": t({
			en: "{currency} per USD",
			es: "{currency} por USD",
		}),
		"transaction.rate.priorCustomDate": t({
			en: "Used on {date}",
			es: "Usada el {date}",
		}),
		"transaction.rate.priorCustomSuggestion": t({
			en: "Prior custom rate",
			es: "Tasa personalizada anterior",
		}),
		"transaction.rate.required": t({
			en: "Enter a positive rate",
			es: "Ingresa una tasa positiva",
		}),
		"transaction.rate.requiredHint": t({
			en: "Enter the amount of this currency equal to one US dollar.",
			es: "Ingresa el monto de esta moneda equivalente a un dólar estadounidense.",
		}),
		"transaction.rate.title": t({
			en: "Entry rate",
			es: "Tasa de la transacción",
		}),
		"transaction.rate.useSuggestion": t({
			en: "Use suggestion",
			es: "Usar sugerencia",
		}),
		"transaction.remind.dayBefore": t({
			en: "1 day before",
			es: "1 día antes",
		}),
		"transaction.remind.daysBefore": t({
			en: "{count} days before",
			es: "{count} días antes",
		}),
		"transaction.remind.off": t({
			en: "Off",
			es: "Desactivado",
		}),
		"transaction.remind.sameDay": t({
			en: "On the day",
			es: "El mismo día",
		}),
		"transaction.remind.weekBefore": t({
			en: "1 week before",
			es: "1 semana antes",
		}),
		"transaction.save.failedBody": t({
			en: "Something went wrong writing this transaction, so nothing was saved. Try again.",
			es: "Algo salió mal al guardar esta transacción, así que no se guardó nada. Inténtalo de nuevo.",
		}),
		"transaction.save.failedTitle": t({
			en: "Not saved",
			es: "No se guardó",
		}),
		"transaction.save.scheduleFailedBody": t({
			en: "Your subscription was saved, but its charges could not be logged. Outlayr will try again the next time you open it.",
			es: "Tu suscripción se guardó, pero no se pudieron registrar sus cargos. Outlayr volverá a intentarlo la próxima vez que la abras.",
		}),
		"transaction.save.scheduleFailedTitle": t({
			en: "Schedule not applied",
			es: "Programación sin aplicar",
		}),
		"transaction.schedule.customOption": t({
			en: "Custom…",
			es: "Personalizado…",
		}),
		"transaction.schedule.customTitle": t({
			en: "Custom Schedule",
			es: "Programación personalizada",
		}),
		"transaction.schedule.every": t({
			en: "Every {interval}",
			es: "Cada {interval}",
		}),
		"transaction.schedule.everyLabel": t({
			en: "Every",
			es: "Cada",
		}),
		"transaction.schedule.fewer": t({
			en: "Fewer",
			es: "Menos",
		}),
		"transaction.schedule.firstPaymentTag": t({
			en: "First payment",
			es: "Primer pago",
		}),
		"transaction.schedule.more": t({
			en: "More",
			es: "Más",
		}),
		"transaction.schedule.nextCharges": t({
			en: "Next charges",
			es: "Próximos cargos",
		}),
		"transaction.schedule.repeats": t({
			en: "Repeats every {interval}",
			es: "Se repite cada {interval}",
		}),
		// Says what the schedule does now, not what it used to: the charge moves
		// for that one month and the anchor day comes back after it.
		"transaction.schedule.shortMonthNote": t({
			en: "A month too short for that day charges on its last day instead.",
			es: "Un mes demasiado corto para ese día cobra su último día.",
		}),
		"transaction.schedule.shortMonthTag": t({
			en: "short month",
			es: "mes corto",
		}),
		"transaction.schedule.unit": t({
			en: "Unit",
			es: "Unidad",
		}),
		"transaction.split.addCategory": t({
			en: "Add category",
			es: "Agregar categoría",
		}),
		"transaction.split.balanced": t({
			en: "Balanced",
			es: "Cuadrado",
		}),
		"transaction.split.chooseCategory": t({
			en: "Choose category",
			es: "Elegir categoría",
		}),
		"transaction.split.count_one": t({
			en: "{count} category",
			es: "{count} categoría",
		}),
		"transaction.split.count_other": t({
			en: "{count} categories",
			es: "{count} categorías",
		}),
		"transaction.split.editAmount": t({
			en: "Edit amount",
			es: "Editar monto",
		}),
		"transaction.split.failedBody": t({
			en: "The entry was saved, but how it splits across categories was not.",
			es: "La transacción se guardó, pero no cómo se divide entre categorías.",
		}),
		"transaction.split.failedTitle": t({
			en: "Couldn't save the split",
			es: "No se pudo guardar la división",
		}),
		"transaction.split.fillRest": t({
			en: "Give the rest to the last category",
			es: "Dar el resto a la última categoría",
		}),
		"transaction.split.remaining": t({
			en: "Left to allocate",
			es: "Por asignar",
		}),
		"transaction.split.removePart": t({
			en: "Remove category",
			es: "Quitar categoría",
		}),
		"transaction.split.row": t({
			en: "Split",
			es: "Dividido",
		}),
		"transaction.split.title": t({
			en: "Split",
			es: "Dividir",
		}),
		"transaction.stopRecurring.failedBody": t({
			en: "The schedule couldn't be stopped, so the next charge will still be logged.",
			es: "No se pudo detener la programación, así que el próximo cargo se registrará igual.",
		}),
		"transaction.stopRecurring.failedTitle": t({
			en: "Still recurring",
			es: "La recurrencia sigue activa",
		}),
		"transaction.tags.create": t({
			en: 'Add "{name}"',
			es: 'Agregar "{name}"',
		}),
		"transaction.tags.empty": t({
			en: "No tags yet. Type a name to add one.",
			es: "Aún no hay etiquetas. Escribe un nombre para agregar una.",
		}),
		"transaction.tags.failedBody": t({
			en: "The entry was saved. Open it again to set its tags.",
			es: "El registro se guardó. Ábrelo de nuevo para asignar sus etiquetas.",
		}),
		"transaction.tags.failedTitle": t({
			en: "Couldn't save the tags",
			es: "No se pudieron guardar las etiquetas",
		}),
		"transaction.tags.none": t({
			en: "None",
			es: "Ninguna",
		}),
		"transaction.tags.searchPlaceholder": t({
			en: "Search or add",
			es: "Buscar o agregar",
		}),
		"transaction.tags.title": t({
			en: "Tags",
			es: "Etiquetas",
		}),
		"transaction.toast.added": t({
			en: "Transaction added",
			es: "Transacción agregada",
		}),
		"transaction.toast.subscriptionAdded": t({
			en: "Subscription added",
			es: "Suscripción agregada",
		}),
		// Bare nouns, unlike `transaction.interval.*`, which embed the count. The
		// sentence renders "Every"/count/unit as three pieces so the count can be
		// styled on its own without either language having to be split on a number.
		"transaction.unit.day": t({ en: "day", es: "día" }),
		"transaction.unit.days": t({ en: "days", es: "días" }),
		"transaction.unit.month": t({ en: "month", es: "mes" }),
		"transaction.unit.months": t({ en: "months", es: "meses" }),
		"transaction.unit.week": t({ en: "week", es: "semana" }),
		"transaction.unit.weeks": t({ en: "weeks", es: "semanas" }),
		"transaction.unit.year": t({ en: "year", es: "año" }),
		"transaction.unit.years": t({ en: "years", es: "años" }),
	},
	key: "transaction" as const,
} satisfies Dictionary;

export default transaction;
