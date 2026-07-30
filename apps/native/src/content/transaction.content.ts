import { type Dictionary, t } from "intlayer";

const transaction = {
	key: "transaction" as const,
	content: {
		"transaction.new.title": t({
			en: "Create Transaction",
			es: "Crear transacción",
		}),
		"transaction.edit.title": t({
			en: "Edit Transaction",
			es: "Editar transacción",
		}),
		"transaction.delete.title": t({
			en: "Delete transaction?",
			es: "¿Eliminar transacción?",
		}),
		"transaction.delete.body": t({
			en: "This action cannot be undone.",
			es: "Esta acción no se puede deshacer.",
		}),
		"transaction.save.failedTitle": t({
			en: "Not saved",
			es: "No se guardó",
		}),
		"transaction.save.failedBody": t({
			en: "Something went wrong writing this transaction, so nothing was saved. Try again.",
			es: "Algo salió mal al guardar esta transacción, así que no se guardó nada. Inténtalo de nuevo.",
		}),
		"transaction.save.scheduleFailedTitle": t({
			en: "Schedule not applied",
			es: "Programación sin aplicar",
		}),
		"transaction.save.scheduleFailedBody": t({
			en: "Your subscription was saved, but its charges could not be logged. Outlayr will try again the next time you open it.",
			es: "Tu suscripción se guardó, pero no se pudieron registrar sus cargos. Outlayr volverá a intentarlo la próxima vez que la abras.",
		}),
		"transaction.stopRecurring.failedTitle": t({
			en: "Still recurring",
			es: "La recurrencia sigue activa",
		}),
		"transaction.stopRecurring.failedBody": t({
			en: "The schedule couldn't be stopped, so the next charge will still be logged.",
			es: "No se pudo detener la programación, así que el próximo cargo se registrará igual.",
		}),
		"transaction.kind.once": t({
			en: "One-time",
			es: "Único",
		}),
		"transaction.kind.subscription": t({
			en: "Subscription",
			es: "Suscripción",
		}),
		"transaction.field.name": t({
			en: "Name",
			es: "Nombre",
		}),
		"transaction.field.namePlaceholder": t({
			en: "Netflix, Groceries…",
			es: "Netflix, Víveres…",
		}),
		"transaction.field.type": t({
			en: "Type",
			es: "Tipo",
		}),
		"transaction.field.amount": t({
			en: "Amount",
			es: "Monto",
		}),
		"transaction.field.tags": t({
			en: "Tags",
			es: "Etiquetas",
		}),
		"transaction.tags.title": t({
			en: "Tags",
			es: "Etiquetas",
		}),
		"transaction.tags.none": t({
			en: "None",
			es: "Ninguna",
		}),
		"transaction.tags.searchPlaceholder": t({
			en: "Search or add",
			es: "Buscar o agregar",
		}),
		"transaction.tags.create": t({
			en: 'Add "{name}"',
			es: 'Agregar "{name}"',
		}),
		"transaction.tags.empty": t({
			en: "No tags yet. Type a name to add one.",
			es: "Aún no hay etiquetas. Escribe un nombre para agregar una.",
		}),
		"transaction.tags.failedTitle": t({
			en: "Couldn't save the tags",
			es: "No se pudieron guardar las etiquetas",
		}),
		"transaction.tags.failedBody": t({
			en: "The entry was saved. Open it again to set its tags.",
			es: "El registro se guardó. Ábrelo de nuevo para asignar sus etiquetas.",
		}),
		"transaction.field.category": t({
			en: "Category",
			es: "Categoría",
		}),
		"transaction.field.schedule": t({
			en: "Schedule",
			es: "Programación",
		}),
		"transaction.field.firstPayment": t({
			en: "First Payment",
			es: "Primer pago",
		}),
		"transaction.field.endDate": t({
			en: "End Date",
			es: "Fecha de fin",
		}),
		"transaction.field.ends": t({
			en: "Ends",
			es: "Termina el",
		}),
		"transaction.field.remind": t({
			en: "Remind Me",
			es: "Recordarme",
		}),
		"transaction.field.date": t({
			en: "Date",
			es: "Fecha",
		}),
		"transaction.field.time": t({
			en: "Time",
			es: "Hora",
		}),
		"transaction.field.notes": t({
			en: "Notes",
			es: "Notas",
		}),
		"transaction.field.notesPlaceholder": t({
			en: "Optional",
			es: "Opcional",
		}),
		"transaction.category.choose": t({
			en: "Choose",
			es: "Elegir",
		}),
		"transaction.cta.save": t({
			en: "Save Changes",
			es: "Guardar cambios",
		}),
		"transaction.cta.add": t({
			en: "Add Transaction",
			es: "Agregar transacción",
		}),
		"transaction.cta.addSubscription": t({
			en: "Add Subscription",
			es: "Agregar suscripción",
		}),
		"transaction.toast.added": t({
			en: "Transaction added",
			es: "Transacción agregada",
		}),
		"transaction.toast.subscriptionAdded": t({
			en: "Subscription added",
			es: "Suscripción agregada",
		}),
		"transaction.cadence.daily": t({
			en: "Daily",
			es: "Diario",
		}),
		"transaction.cadence.weekly": t({
			en: "Weekly",
			es: "Semanal",
		}),
		"transaction.cadence.monthly": t({
			en: "Monthly",
			es: "Mensual",
		}),
		"transaction.cadence.yearly": t({
			en: "Yearly",
			es: "Anual",
		}),
		"transaction.cadence.days": t({
			en: "Days",
			es: "Días",
		}),
		"transaction.cadence.weeks": t({
			en: "Weeks",
			es: "Semanas",
		}),
		"transaction.cadence.months": t({
			en: "Months",
			es: "Meses",
		}),
		"transaction.cadence.years": t({
			en: "Years",
			es: "Años",
		}),
		"transaction.interval.day": t({
			en: "day",
			es: "día",
		}),
		"transaction.interval.days": t({
			en: "{count} days",
			es: "{count} días",
		}),
		"transaction.interval.week": t({
			en: "week",
			es: "semana",
		}),
		"transaction.interval.weeks": t({
			en: "{count} weeks",
			es: "{count} semanas",
		}),
		"transaction.interval.month": t({
			en: "month",
			es: "mes",
		}),
		"transaction.interval.months": t({
			en: "{count} months",
			es: "{count} meses",
		}),
		"transaction.interval.year": t({
			en: "year",
			es: "año",
		}),
		"transaction.interval.years": t({
			en: "{count} years",
			es: "{count} años",
		}),
		"transaction.schedule.every": t({
			en: "Every {interval}",
			es: "Cada {interval}",
		}),
		"transaction.schedule.repeats": t({
			en: "Repeats every {interval}",
			es: "Se repite cada {interval}",
		}),
		"transaction.schedule.customOption": t({
			en: "Custom…",
			es: "Personalizado…",
		}),
		"transaction.schedule.customTitle": t({
			en: "Custom Schedule",
			es: "Programación personalizada",
		}),
		"transaction.schedule.everyLabel": t({
			en: "Every",
			es: "Cada",
		}),
		"transaction.schedule.unit": t({
			en: "Unit",
			es: "Unidad",
		}),
		"transaction.remind.off": t({
			en: "Off",
			es: "Desactivado",
		}),
		"transaction.remind.sameDay": t({
			en: "On the day",
			es: "El mismo día",
		}),
		"transaction.remind.dayBefore": t({
			en: "1 day before",
			es: "1 día antes",
		}),
		"transaction.remind.daysBefore": t({
			en: "{count} days before",
			es: "{count} días antes",
		}),
		"transaction.remind.weekBefore": t({
			en: "1 week before",
			es: "1 semana antes",
		}),
		"transaction.amount.changeCurrency": t({
			en: "Change currency",
			es: "Cambiar moneda",
		}),
		"transaction.numpad.delete": t({
			en: "Delete",
			es: "Borrar",
		}),
		"transaction.identity.tab.photo": t({
			en: "Photo",
			es: "Foto",
		}),
		"transaction.identity.tab.emoji": t({
			en: "Emoji",
			es: "Emoji",
		}),
		"transaction.identity.tab.icons": t({
			en: "Icons",
			es: "Íconos",
		}),
		"transaction.identity.searchIcons": t({
			en: "Search icons",
			es: "Buscar íconos",
		}),
		"transaction.identity.noIcons": t({
			en: "No icons found",
			es: "No se encontraron íconos",
		}),
		"transaction.identity.changePhotoPrompt": t({
			en: "Tap to change photo",
			es: "Toca para cambiar la foto",
		}),
		"transaction.identity.selectPhotoPrompt": t({
			en: "Tap to select a photo",
			es: "Toca para elegir una foto",
		}),
		"transaction.identity.color": t({
			en: "Color",
			es: "Color",
		}),
		"transaction.identity.autoDetected": t({
			en: "Auto-detected",
			es: "Detectado automáticamente",
		}),
		"transaction.identity.primaryColor": t({
			en: "Primary color from image",
			es: "Color principal de la imagen",
		}),
		"transaction.identity.pickPhotoFirst": t({
			en: "Pick a photo first",
			es: "Primero elige una foto",
		}),
		"transaction.identity.changePhoto": t({
			en: "Change photo",
			es: "Cambiar foto",
		}),
		"transaction.identity.selectPhoto": t({
			en: "Select photo",
			es: "Seleccionar foto",
		}),
		"transaction.identity.colorUsed": t({
			en: "Already used by another category",
			es: "Ya usada por otra categoría",
		}),
		"transaction.identity.hero.logo": t({
			en: "Add a logo or icon",
			es: "Agrega un logo o ícono",
		}),
		"transaction.identity.hero.logoHint": t({
			en: "Opens the logo picker",
			es: "Abre el selector de logos",
		}),
		"transaction.identity.hero.removeLogo": t({
			en: "Remove logo",
			es: "Quitar logo",
		}),
		"transaction.identity.hero.icon": t({
			en: "Category icon",
			es: "Ícono de categoría",
		}),
		"transaction.identity.hero.iconHint": t({
			en: "Opens the icon picker",
			es: "Abre el selector de íconos",
		}),
		"transaction.identity.hero.removeIcon": t({
			en: "Remove icon",
			es: "Quitar ícono",
		}),
		"transaction.identity.hero.chooseIcon": t({
			en: "Choose an icon & color",
			es: "Elige un ícono y color",
		}),
		"transaction.identity.hero.tapToChange": t({
			en: "Tap to change",
			es: "Toca para cambiar",
		}),
		"transaction.lock.prompt": t({
			en: "Unlock Outlayr",
			es: "Desbloquear Outlayr",
		}),
		"transaction.lock.title": t({
			en: "Outlayr is Locked",
			es: "Outlayr está bloqueada",
		}),
		"transaction.lock.checking": t({
			en: "Checking…",
			es: "Verificando…",
		}),
		"transaction.lock.unlock": t({
			en: "Unlock",
			es: "Desbloquear",
		}),
		"transaction.localData.title": t({
			en: "Something Went Wrong",
			es: "Algo salió mal",
		}),
		"transaction.localData.body": t({
			en: "Outlayr could not open your data. This is often temporary — try again first. Your ledger is still on this device.",
			es: "Outlayr no pudo abrir tus datos. Suele ser temporal — inténtalo de nuevo. Tu registro sigue en este dispositivo.",
		}),
		"transaction.localData.retrying": t({
			en: "Trying…",
			es: "Intentando…",
		}),
	},
} satisfies Dictionary;

export default transaction;
