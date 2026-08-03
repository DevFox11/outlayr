import { type Dictionary, t } from "intlayer";

const settings = {
	key: "settings" as const,
	content: {
		"settings.account.rowTitle": t({
			en: "Account",
			es: "Cuenta",
		}),
		"settings.account.sectionTitle": t({
			en: "Account",
			es: "Cuenta",
		}),
		"settings.account.eyebrow": t({
			en: "Account",
			es: "Cuenta",
		}),
		"settings.account.signedInAs": t({
			en: "Signed in as",
			es: "Sesi\u00f3n iniciada como",
		}),
		"settings.account.signedInFallback": t({
			en: "Signed in",
			es: "Sesi\u00f3n iniciada",
		}),
		"settings.account.notSignedIn": t({
			en: "Not signed in",
			es: "Sin sesi\u00f3n",
		}),
		"settings.account.checking": t({
			en: "Checking\u2026",
			es: "Comprobando\u2026",
		}),
		"settings.account.unavailable": t({
			en: "Unavailable",
			es: "No disponible",
		}),
		"settings.account.signOut": t({
			en: "Sign Out",
			es: "Cerrar sesi\u00f3n",
		}),
		"settings.account.signingOut": t({
			en: "Signing out\u2026",
			es: "Cerrando sesi\u00f3n\u2026",
		}),
		"settings.account.deleteSection": t({
			en: "Deleting your account",
			es: "Eliminar tu cuenta",
		}),
		"settings.account.delete": t({
			en: "Delete account",
			es: "Eliminar cuenta",
		}),
		"settings.account.deleting": t({
			en: "Deleting…",
			es: "Eliminando…",
		}),
		"settings.account.deleteFooter": t({
			en: "Deletes your account and everything synced to it. The ledger on this device stays, and signing in again adopts it.",
			es: "Elimina tu cuenta y todo lo sincronizado en ella. El registro de este dispositivo se conserva, y al volver a iniciar sesión se adopta.",
		}),
		"settings.account.deleteConfirmTitle": t({
			en: "Delete this account?",
			es: "¿Eliminar esta cuenta?",
		}),
		"settings.account.deleteConfirmBody": t({
			en: "Your account and everything synced to it are removed for good. The ledger on this device is not touched.",
			es: "Tu cuenta y todo lo sincronizado en ella se eliminan de forma definitiva. El registro de este dispositivo no se toca.",
		}),
		"settings.account.deleteConfirm": t({
			en: "Delete",
			es: "Eliminar",
		}),
		"settings.account.signOutFooter": t({
			en: "Signing out ends the session on this iPhone. Every transaction, budget and category stays exactly where it is.",
			es: "Cerrar sesi\u00f3n termina la sesi\u00f3n en este iPhone. Cada transacci\u00f3n, presupuesto y categor\u00eda se queda exactamente donde est\u00e1.",
		}),
		"settings.account.signedOutDetail": t({
			en: "Outlayr keeps your ledger on this device and behaves exactly the same signed out. An account exists only so a later release can sync it to your other devices.",
			es: "Outlayr guarda tu registro en este dispositivo y funciona igual sin sesi\u00f3n. La cuenta existe solo para que una versi\u00f3n futura pueda sincronizarlo con tus otros dispositivos.",
		}),
		"settings.account.unavailableDetail": t({
			en: "This build ships without a backend, so there is no account to sign in to. Nothing else is affected \u2014 your ledger lives on this device.",
			es: "Esta versi\u00f3n no incluye backend, as\u00ed que no hay cuenta con la que iniciar sesi\u00f3n. Nada m\u00e1s se ve afectado \u2014 tu registro vive en este dispositivo.",
		}),
		"settings.account.noProvider": t({
			en: "No sign-in provider is configured for this platform.",
			es: "No hay ning\u00fan proveedor de inicio de sesi\u00f3n configurado para esta plataforma.",
		}),
		"settings.account.playServices": t({
			en: "Google Play services are unavailable on this device.",
			es: "Los servicios de Google Play no est\u00e1n disponibles en este dispositivo.",
		}),
		"settings.account.genericFailure": t({
			en: "Sign-in didn't complete. Your ledger on this device is untouched.",
			es: "El inicio de sesi\u00f3n no se complet\u00f3. Tu registro en este dispositivo est\u00e1 intacto.",
		}),
		"settings.screenTitle": t({
			en: "Settings",
			es: "Configuración",
		}),
		"settings.section.logging": t({
			en: "Logging",
			es: "Registro",
		}),
		"settings.section.appearance": t({
			en: "Appearance",
			es: "Apariencia",
		}),
		"settings.section.log": t({
			en: "The Log",
			es: "El registro",
		}),
		"settings.section.data": t({
			en: "Your data",
			es: "Tus datos",
		}),
		"settings.section.device": t({
			en: "This device",
			es: "Este dispositivo",
		}),
		"settings.row.currency": t({
			en: "Currency",
			es: "Moneda",
		}),
		"settings.row.numberEntry": t({
			en: "Number Entry",
			es: "Ingreso de números",
		}),
		"settings.row.timeFrames": t({
			en: "Time Frames",
			es: "Períodos de tiempo",
		}),
		"settings.row.incomeTracking": t({
			en: "Income Tracking",
			es: "Seguimiento de ingresos",
		}),
		"settings.row.theme": t({
			en: "Theme",
			es: "Tema",
		}),
		"settings.row.appIcon": t({
			en: "App Icon",
			es: "Ícono de la app",
		}),
		"settings.row.displayCents": t({
			en: "Display Cents",
			es: "Mostrar centavos",
		}),
		"settings.row.displaySign": t({
			en: "Display +/− Symbol",
			es: "Mostrar símbolo +/−",
		}),
		"settings.row.upcoming": t({
			en: "Upcoming Logs",
			es: "Próximos registros",
		}),
		"settings.row.logTrendLine": t({
			en: "Log Trend Line",
			es: "Línea de tendencia",
		}),
		"settings.row.animatedCharts": t({
			en: "Animated Charts",
			es: "Gráficos animados",
		}),
		"settings.row.categories": t({
			en: "Categories",
			es: "Categorías",
		}),
		"settings.row.sync": t({
			en: "Sync",
			es: "Sincronización",
		}),
		"settings.row.syncUnavailable": t({
			en: "Not available",
			es: "No disponible",
		}),
		"settings.sync.upToDate": t({
			en: "Up to date",
			es: "Al día",
		}),
		"settings.sync.never": t({
			en: "Not synced yet",
			es: "Aún sin sincronizar",
		}),
		"settings.sync.pending": t({
			en: "{count} waiting to sync",
			es: "{count} en espera de sincronizar",
		}),
		"settings.sync.pendingOne": t({
			en: "1 waiting to sync",
			es: "1 en espera de sincronizar",
		}),
		"settings.sync.navTitle": t({
			en: "Sync",
			es: "Sincronización",
		}),
		"settings.sync.eyebrow": t({
			en: "This device",
			es: "Este dispositivo",
		}),
		"settings.sync.on": t({
			en: "Syncing",
			es: "Sincronizando",
		}),
		"settings.sync.off": t({
			en: "Not syncing",
			es: "Sin sincronizar",
		}),
		"settings.sync.onDetail": t({
			en: "Every change you make here is queued for your account and reaches your other devices.",
			es: "Cada cambio que haces aquí se pone en cola para tu cuenta y llega a tus otros dispositivos.",
		}),
		"settings.sync.offDetail": t({
			en: "Nothing leaves this iPhone. Your ledger is complete here and works exactly as it does now.",
			es: "Nada sale de este iPhone. Tu registro está completo aquí y funciona igual que ahora.",
		}),
		"settings.sync.section": t({
			en: "Replication",
			es: "Replicación",
		}),
		"settings.sync.toggle": t({
			en: "Sync this device",
			es: "Sincronizar este dispositivo",
		}),
		"settings.sync.footer": t({
			en: "Turning sync off keeps every transaction, budget and category on this iPhone — it only stops queueing them for your account. Turning it back on hands over everything logged in between.",
			es: "Desactivar la sincronización conserva cada transacción, presupuesto y categoría en este iPhone — solo deja de ponerlos en cola para tu cuenta. Al activarla de nuevo se entrega todo lo registrado mientras tanto.",
		}),
		"settings.sync.statusSection": t({
			en: "Status",
			es: "Estado",
		}),
		"settings.sync.waiting": t({
			en: "Waiting to sync",
			es: "En espera de sincronizar",
		}),
		"settings.sync.lastSynced": t({
			en: "Last synced",
			es: "Última sincronización",
		}),
		"settings.sync.neverSynced": t({
			en: "Never",
			es: "Nunca",
		}),
		"settings.sync.needsAccount": t({
			en: "Sync needs an account to replicate to. Until you sign in your ledger stays on this device, which is all Outlayr ever needed to work.",
			es: "La sincronización necesita una cuenta a la que replicar. Hasta que inicies sesión tu registro se queda en este dispositivo, que es todo lo que Outlayr necesitó siempre para funcionar.",
		}),
		"settings.sync.working": t({
			en: "Working…",
			es: "Trabajando…",
		}),
		"settings.sync.failedTitle": t({
			en: "Sync setting unchanged",
			es: "La sincronización no cambió",
		}),
		"settings.sync.failedBody": t({
			en: "The switch is where it was and your ledger is untouched. Try again in a moment.",
			es: "El interruptor sigue como estaba y tu registro está intacto. Inténtalo de nuevo en un momento.",
		}),
		"settings.row.deleted": t({
			en: "Recently Deleted",
			es: "Eliminados recientemente",
		}),
		"settings.deleted.navTitle": t({
			en: "Recently Deleted",
			es: "Eliminados recientemente",
		}),
		"settings.deleted.section": t({
			en: "Deleted entries",
			es: "Entradas eliminadas",
		}),
		"settings.deleted.restore": t({
			en: "Restore",
			es: "Restaurar",
		}),
		"settings.deleted.restoreEntry": t({
			en: "Restore {note}",
			es: "Restaurar {note}",
		}),
		"settings.deleted.deletedOn": t({
			en: "Deleted {date}",
			es: "Eliminada {date}",
		}),
		"settings.deleted.empty": t({
			en: "Nothing has been deleted. Entries you delete arrive here and wait — Outlayr never throws one away.",
			es: "No has eliminado nada. Las entradas que elimines llegan aquí y esperan — Outlayr nunca descarta ninguna.",
		}),
		"settings.deleted.footer": t({
			en: "Restoring puts the entry back on the Log exactly where its date belongs. A subscription you ended stays ended: only the charge comes back, never the schedule.",
			es: "Restaurar devuelve la entrada al registro justo donde le corresponde por fecha. Una suscripción que terminaste sigue terminada: vuelve solo el cargo, nunca la programación.",
		}),
		"settings.deleted.failedTitle": t({
			en: "Entry not restored",
			es: "La entrada no se restauró",
		}),
		"settings.deleted.failedBody": t({
			en: "It is still here and nothing was lost. Try restoring it again.",
			es: "Sigue aquí y no se perdió nada. Intenta restaurarla de nuevo.",
		}),
		"settings.row.import": t({
			en: "Import Data",
			es: "Importar datos",
		}),
		"settings.row.export": t({
			en: "Export Data",
			es: "Exportar datos",
		}),
		"settings.row.erase": t({
			en: "Erase Data",
			es: "Borrar datos",
		}),
		"settings.row.notifications": t({
			en: "Notifications",
			es: "Notificaciones",
		}),
		"settings.row.authentication": t({
			en: "Authentication",
			es: "Autenticación",
		}),
		"settings.row.haptics": t({
			en: "Haptics",
			es: "Vibración",
		}),
		"settings.row.featureLab": t({
			en: "Feature Lab",
			es: "Laboratorio de funciones",
		}),
		"settings.row.reportBug": t({
			en: "Report Bug",
			es: "Reportar un error",
		}),
		"settings.row.featureRequest": t({
			en: "Feature Request",
			es: "Sugerir una función",
		}),
		"settings.row.rate": t({
			en: "Rate on App Store",
			es: "Califica en el App Store",
		}),
		"settings.row.share": t({
			en: "Share with Friends",
			es: "Comparte con amigos",
		}),
		"settings.row.followX": t({
			en: "Follow Outlayr on X",
			es: "Sigue a Outlayr en X",
		}),
		"settings.row.about": t({
			en: "About & Credits",
			es: "Acerca de & Créditos",
		}),
		"settings.lock.promptOn": t({
			en: "Turn on authentication",
			es: "Activar la autenticación",
		}),
		"settings.lock.promptOff": t({
			en: "Turn off authentication",
			es: "Desactivar la autenticación",
		}),
		"settings.lock.alertTitle": t({
			en: "Authentication",
			es: "Autenticación",
		}),
		"settings.support.bugSubject": t({
			en: "Support Email",
			es: "Correo de soporte",
		}),
		"settings.support.featureSubject": t({
			en: "Feature Request",
			es: "Solicitud de función",
		}),
		"settings.share.message": t({
			en: "Track your money with Outlayr — {url}",
			es: "Controla tu dinero con Outlayr — {url}",
		}),
		"settings.about.version": t({
			en: "Version {version}",
			es: "Versión {version}",
		}),
		"settings.about.intro": t({
			en: "Outlayr is open source and free forever. It is built on the foundation of Dime, a beautiful expense tracker created by Rafael Soh, and is distributed under the GNU General Public License v3.0.",
			es: "Outlayr es de código abierto y gratuito para siempre. Está basado en Dime, un hermoso rastreador de gastos creado por Rafael Soh, y se distribuye bajo la GNU General Public License v3.0.",
		}),
		"settings.about.links": t({
			en: "Links",
			es: "Enlaces",
		}),
		"settings.about.outlayrRepo": t({
			en: "Outlayr on GitHub",
			es: "Outlayr en GitHub",
		}),
		"settings.about.dimeRepo": t({
			en: "Dime (original project)",
			es: "Dime (proyecto original)",
		}),
		"settings.about.gplLink": t({
			en: "GPL-3.0 License",
			es: "Licencia GPL-3.0",
		}),
		"settings.about.licenceHeading": t({
			en: "Licence",
			es: "Licencia",
		}),
		"settings.about.fork": t({
			en: "Outlayr is a modified version of Dime, forked in 2026 and changed since.",
			es: "Outlayr es una versión modificada de Dime, bifurcada en 2026 y cambiada desde entonces.",
		}),
		"settings.about.copyright": t({
			en: "Copyright © 2022–2023 Rafael Soh and Dime contributors. Modifications copyright © 2026 Daniel Esteves.",
			es: "Copyright © 2022–2023 Rafael Soh y colaboradores de Dime. Modificaciones copyright © 2026 Daniel Esteves.",
		}),
		"settings.about.warranty": t({
			en: "Outlayr comes with ABSOLUTELY NO WARRANTY, to the extent permitted by law. You may redistribute it under the terms of the GNU General Public License v3.0.",
			es: "Outlayr se distribuye SIN NINGUNA GARANTÍA, en la medida permitida por la ley. Puedes redistribuirlo bajo los términos de la GNU General Public License v3.0.",
		}),
		"settings.appIcon.section": t({
			en: "Home screen",
			es: "Pantalla de inicio",
		}),
		"settings.appIcon.unsupported": t({
			en: "This device does not allow the app icon to be changed.",
			es: "Este dispositivo no permite cambiar el ícono de la app.",
		}),
		"settings.appIcon.alertNote": t({
			en: "iOS confirms every change with an alert of its own.",
			es: "iOS confirma cada cambio con su propia alerta.",
		}),
		"settings.appIcon.failedTitle": t({
			en: "Icon unchanged",
			es: "El ícono no cambió",
		}),
		"settings.appIcon.failedBody": t({
			en: "iOS refused the change. Your home screen still shows the icon marked here.",
			es: "iOS rechazó el cambio. Tu pantalla de inicio sigue mostrando el ícono marcado aquí.",
		}),
		"settings.currency.search": t({
			en: "Search currencies",
			es: "Buscar monedas",
		}),
		"settings.currency.favourites": t({
			en: "Favourites",
			es: "Favoritas",
		}),
		"settings.currency.all": t({
			en: "All currencies",
			es: "Todas las monedas",
		}),
		"settings.currency.favourite": t({
			en: "Add {code} to favourites",
			es: "Agregar {code} a favoritas",
		}),
		"settings.currency.unfavourite": t({
			en: "Remove {code} from favourites",
			es: "Quitar {code} de favoritas",
		}),
		"settings.currency.favouritesFull": t({
			en: "Favourites full ({limit})",
			es: "Favoritas al límite ({limit})",
		}),
		"settings.currency.favouritesFullBody": t({
			en: "Remove one to make room.",
			es: "Quita una para hacer espacio.",
		}),
		"settings.currency.favouritesHint": t({
			en: "Hold a currency to keep it here.",
			es: "Mantén presionada una moneda para guardarla aquí.",
		}),
		"settings.currency.use": t({
			en: "Use {code}",
			es: "Usar {code}",
		}),
		"settings.currency.favouriteAction": t({
			en: "Favourite",
			es: "Favorita",
		}),
		"settings.currency.unfavouriteAction": t({
			en: "Unfavourite",
			es: "Quitar",
		}),
		"settings.currency.favouritesFullShort": t({
			en: "Full ({limit})",
			es: "Al límite ({limit})",
		}),
		"settings.erase.onThisDevice": t({
			en: "On this device",
			es: "En este dispositivo",
		}),
		"settings.erase.transactionLogged": t({
			en: "transaction logged",
			es: "transacción registrada",
		}),
		"settings.erase.transactionsLogged": t({
			en: "transactions logged",
			es: "transacciones registradas",
		}),
		"settings.erase.section": t({
			en: "Erase",
			es: "Borrar",
		}),
		"settings.erase.action": t({
			en: "Erase",
			es: "Borrar",
		}),
		"settings.erase.footer": t({
			en: "Your categories are kept either way — they are the vocabulary you built, not the records you logged.",
			es: "Tus categorías se conservan en ambos casos — son el vocabulario que construiste, no los registros que anotaste.",
		}),
		"settings.erase.transactionsOnly": t({
			en: "Transactions only",
			es: "Solo las transacciones",
		}),
		"settings.erase.transactionsAndBudgets": t({
			en: "Transactions and budgets",
			es: "Transacciones y presupuestos",
		}),
		"settings.erase.confirmTransactionsTitle": t({
			en: "Erase transactions?",
			es: "¿Borrar las transacciones?",
		}),
		"settings.erase.confirmTransactionsBody": t({
			en: "Every transaction and recurring template will be deleted. Budgets and categories are kept. This can't be undone.",
			es: "Se eliminarán todas las transacciones y plantillas recurrentes. Los presupuestos y las categorías se conservan. Esto no se puede deshacer.",
		}),
		"settings.erase.confirmEverythingTitle": t({
			en: "Erase everything?",
			es: "¿Borrar todo?",
		}),
		"settings.erase.confirmEverythingBody": t({
			en: "Every transaction, recurring template and budget will be deleted. Only your categories are kept. This can't be undone.",
			es: "Se eliminarán todas las transacciones, plantillas recurrentes y presupuestos. Solo se conservan tus categorías. Esto no se puede deshacer.",
		}),
		"settings.erase.failedTitle": t({
			en: "Erase didn't finish",
			es: "El borrado no terminó",
		}),
		"settings.erase.failedBody": t({
			en: "Part of your data may still be on this device. Try erasing again.",
			es: "Parte de tus datos podría seguir en este dispositivo. Intenta borrar de nuevo.",
		}),
		"settings.export.footer": t({
			en: "Deleted transactions are left out. Every other transaction is written, newest first — six columns of it.",
			es: "Las transacciones eliminadas se omiten. Todas las demás se escriben, de la más reciente a la más antigua, en seis columnas.",
		}),
		"settings.export.ready": t({
			en: "Ready to export",
			es: "Listo para exportar",
		}),
		"settings.export.transaction": t({
			en: "transaction",
			es: "transacción",
		}),
		"settings.export.transactions": t({
			en: "transactions",
			es: "transacciones",
		}),
		"settings.export.action": t({
			en: "Export CSV",
			es: "Exportar CSV",
		}),
		"settings.export.shareTitle": t({
			en: "Export transactions",
			es: "Exportar transacciones",
		}),
		"settings.export.failedTitle": t({
			en: "Export failed",
			es: "Error al exportar",
		}),
		"settings.export.failedBody": t({
			en: "The file couldn't be written.",
			es: "No se pudo escribir el archivo.",
		}),
		"settings.export.archiveTitle": t({
			en: "Full archive",
			es: "Archivo completo",
		}),
		"settings.export.archiveAction": t({
			en: "Export a full archive",
			es: "Exportar un archivo completo",
		}),
		"settings.export.archiveNote": t({
			en: "Carries every entry, category and budget in full, including the things the CSV leaves behind. This is the file to restore from.",
			es: "Incluye cada registro, categoría y presupuesto por completo, con lo que el CSV deja fuera. Este es el archivo desde el que se restaura.",
		}),
		"settings.export.archiveShareTitle": t({
			en: "Outlayr archive",
			es: "Archivo de Outlayr",
		}),
		"settings.export.columns": t({
			en: "Columns",
			es: "Columnas",
		}),
		"settings.export.columnsNote": t({
			en: "Dates are ISO 8601 instants and amounts are plain decimals with no grouping, so the file reads back into Outlayr — or into a spreadsheet — as the same figures.",
			es: "Las fechas son instantes ISO 8601 y los montos son decimales simples sin separadores de miles, así que el archivo se vuelve a leer en Outlayr — o en una hoja de cálculo — con las mismas cifras.",
		}),
		"settings.export.omitted": t({
			en: "Not in the file",
			es: "No está en el archivo",
		}),
		"settings.export.omittedDetails": t({
			en: "Notes — the longer text under a transaction",
			es: "Notas — el texto más largo debajo de una transacción",
		}),
		"settings.export.omittedPhotos": t({
			en: "Photos",
			es: "Fotos",
		}),
		"settings.export.omittedLook": t({
			en: "Emoji, icon and color",
			es: "Emoji, icono y color",
		}),
		"settings.export.omittedRecurrence": t({
			en: "Subscription schedules and their reminders",
			es: "La programación de las suscripciones y sus recordatorios",
		}),
		"settings.export.omittedNote": t({
			en: "A CSV is a readable copy of your figures, not a backup. Reading one back in re-creates only the date, name, amount, currency and type of each transaction, and every category has to be linked by hand — the file cannot create one. Your budgets, your categories and everything listed above live only on this device.",
			es: "Un CSV es una copia legible de tus cifras, no un respaldo. Al volver a importarlo solo se recrean la fecha, el nombre, el monto, la moneda y el tipo de cada transacción, y cada categoría debe vincularse a mano — el archivo no puede crearla. Tus presupuestos, tus categorías y todo lo anterior existen únicamente en este dispositivo.",
		}),
		"settings.featureLab.addingSection": t({
			en: "Adding a transaction",
			es: "Al agregar una transacción",
		}),
		"settings.featureLab.confettiNote": t({
			en: "Throws confetti over a transaction the moment you add it.",
			es: "Lanza confeti sobre una transacción en el momento en que la agregas.",
		}),
		"settings.featureLab.confetti": t({
			en: "Celebrate Expenses",
			es: "Celebrar gastos",
		}),
		"settings.featureLab.aiSection": t({
			en: "Smart fill",
			es: "Autocompletado",
		}),
		"settings.featureLab.aiEnrichment": t({
			en: "Suggest Category and Tags",
			es: "Sugerir categoría y etiquetas",
		}),
		"settings.featureLab.aiEnrichmentNote": t({
			en: "Well-known services are recognised on this device, with nothing sent anywhere. For anything else, only the name you typed and your own category names leave the device — never amounts, dates or accounts.",
			es: "Los servicios conocidos se reconocen en este dispositivo, sin enviar nada. En los demás casos solo salen del dispositivo el nombre que escribiste y los nombres de tus categorías, nunca importes, fechas ni cuentas.",
		}),
		"settings.featureLab.experimental": t({
			en: "Experimental — these can change or disappear.",
			es: "Experimental — esto puede cambiar o desaparecer.",
		}),
		"settings.featureLab.lineGraph": t({
			en: "Show Line Graph",
			es: "Mostrar gráfico de líneas",
		}),
		"settings.featureLab.budgetsSection": t({
			en: "Budgets",
			es: "Presupuestos",
		}),
		"settings.featureLab.budgetRowsNote": t({
			en: "Off lays the budgets out as a two-up grid of cards instead of a list.",
			es: "Desactivado muestra los presupuestos como una cuadrícula de tarjetas de dos en dos en vez de una lista.",
		}),
		"settings.featureLab.budgetRows": t({
			en: "Budget Rows",
			es: "Filas de presupuesto",
		}),
		"settings.featureLab.transactionRowsSection": t({
			en: "Transaction rows",
			es: "Filas de transacción",
		}),
		"settings.featureLab.swapTimeNote": t({
			en: "Each transaction shows its category instead of its time. If you never write your own note, the note is already the category name, so both lines will read the same.",
			es: "Cada transacción muestra su categoría en vez de su hora. Si nunca escribes tu propia nota, la nota ya es el nombre de la categoría, así que ambas líneas dirán lo mismo.",
		}),
		"settings.featureLab.swapTime": t({
			en: "Replace Time Label",
			es: "Reemplazar etiqueta de hora",
		}),
		"settings.haptics.section": t({
			en: "Feedback",
			es: "Respuesta",
		}),
		"settings.haptics.none": t({
			en: "None",
			es: "Ninguna",
		}),
		"settings.haptics.noneDetail": t({
			en: "No taps at all.",
			es: "Sin ningún toque.",
		}),
		"settings.haptics.subtle": t({
			en: "Subtle",
			es: "Suave",
		}),
		"settings.haptics.subtleDetail": t({
			en: "A light tap when something lands.",
			es: "Un toque ligero cuando algo se registra.",
		}),
		"settings.haptics.excessive": t({
			en: "Excessive",
			es: "Excesiva",
		}),
		"settings.haptics.excessiveDetail": t({
			en: "A tap for every action.",
			es: "Un toque en cada acción.",
		}),
		"settings.notifications.section": t({
			en: "Daily reminder",
			es: "Recordatorio diario",
		}),
		"settings.notifications.footer": t({
			en: "One reminder a day, from this device. Outlayr never sends anything from a server.",
			es: "Un recordatorio al día, desde este dispositivo. Outlayr nunca envía nada desde un servidor.",
		}),
		"settings.notifications.toggle": t({
			en: "Remind Me to Log",
			es: "Recuérdame registrar",
		}),
		"settings.notifications.whenSection": t({
			en: "When",
			es: "Cuándo",
		}),
		"settings.notifications.morning": t({
			en: "Every morning",
			es: "Cada mañana",
		}),
		"settings.notifications.morningDetail": t({
			en: "A nudge at 8:00 AM, before the day has spent anything.",
			es: "Un aviso a las 8:00 a. m., antes de que el día haya gastado nada.",
		}),
		"settings.notifications.evening": t({
			en: "Every evening",
			es: "Cada tarde",
		}),
		"settings.notifications.eveningDetail": t({
			en: "A nudge at 8:00 PM, once the day is mostly done.",
			es: "Un aviso a las 8:00 p. m., cuando el día ya casi termina.",
		}),
		"settings.notifications.custom": t({
			en: "Custom time",
			es: "Hora personalizada",
		}),
		"settings.notifications.nextAt": t({
			en: "Next reminder at {time}.",
			es: "Próximo recordatorio a las {time}.",
		}),
		"settings.notifications.time": t({
			en: "Time",
			es: "Hora",
		}),
		"settings.notifications.deniedTitle": t({
			en: "Notifications are off",
			es: "Las notificaciones están desactivadas",
		}),
		"settings.notifications.deniedBody": t({
			en: "Outlayr cannot ask again once you have declined. Turn notifications on for Outlayr in iOS Settings and this switch will follow.",
			es: "Outlayr no puede volver a preguntar una vez que las rechazaste. Activa las notificaciones para Outlayr en Configuración de iOS y este interruptor las seguirá.",
		}),
		"settings.notifications.notNow": t({
			en: "Not now",
			es: "Ahora no",
		}),
		"settings.notifications.openSettings": t({
			en: "Open Settings",
			es: "Abrir Configuración",
		}),
		"settings.notifications.subscriptionSection": t({
			en: "Subscription charges",
			es: "Cobros de suscripciones",
		}),
		"settings.notifications.subscriptionToggle": t({
			en: "Warn Me Before a Charge",
			es: "Avísame antes de un cobro",
		}),
		"settings.notifications.subscriptionFooter": t({
			en: "Each subscription decides how far ahead it warns you, on its own screen. Off silences all of them without changing what any one of them says.",
			es: "Cada suscripción decide con cuánta antelación te avisa, en su propia pantalla. Desactivarlo las silencia todas sin cambiar lo que cada una indica.",
		}),
		"settings.numberEntry.section": t({
			en: "Amount keypad",
			es: "Teclado de montos",
		}),
		"settings.numberEntry.type1": t({
			en: "Type 1",
			es: "Tipo 1",
		}),
		"settings.numberEntry.type1Title": t({
			en: "Type 1 · Pre-dotted",
			es: "Tipo 1 · Con decimales",
		}),
		"settings.numberEntry.type1Detail": t({
			en: "The last two digits are cents. Type 1234 to get 12.34.",
			es: "Los dos últimos dígitos son centavos. Escribe 1234 para obtener 12.34.",
		}),
		"settings.numberEntry.type2": t({
			en: "Type 2",
			es: "Tipo 2",
		}),
		"settings.numberEntry.type2Title": t({
			en: "Type 2 · Cent-less",
			es: "Tipo 2 · Sin centavos",
		}),
		"settings.numberEntry.type2Detail": t({
			en: "Whole amounts only. Type 12 to get 12.",
			es: "Solo montos enteros. Escribe 12 para obtener 12.",
		}),
		"settings.theme.system": t({
			en: "System",
			es: "Sistema",
		}),
		"settings.theme.systemDetail": t({
			en: "Follows your device.",
			es: "Sigue a tu dispositivo.",
		}),
		"settings.theme.light": t({
			en: "Light",
			es: "Claro",
		}),
		"settings.theme.lightDetail": t({
			en: "Always light, whatever the device does.",
			es: "Siempre claro, haga lo que haga el dispositivo.",
		}),
		"settings.theme.dark": t({
			en: "Dark",
			es: "Oscuro",
		}),
		"settings.theme.darkDetail": t({
			en: "Always dark, whatever the device does.",
			es: "Siempre oscuro, haga lo que haga el dispositivo.",
		}),
		"settings.time.weekSection": t({
			en: "START OF WEEK",
			es: "INICIO DE LA SEMANA",
		}),
		"settings.time.monthSection": t({
			en: "START OF MONTH",
			es: "INICIO DEL MES",
		}),
		"settings.time.sunday": t({
			en: "Sunday",
			es: "Domingo",
		}),
		"settings.time.monday": t({
			en: "Monday",
			es: "Lunes",
		}),
		"settings.time.dayOfMonth": t({
			en: "{day} of month",
			es: "día {day} del mes",
		}),
		"settings.time.reopenNote": t({
			en: "Close and reopen the app for the month start to take full effect.",
			es: "Cierra y vuelve a abrir la app para que el inicio de mes tenga efecto completo.",
		}),
		"settings.upcoming.section": t({
			en: "On the Log",
			es: "En el registro",
		}),
		"settings.upcoming.footer": t({
			en: "Transactions dated in the future sit at the top of the Log, above today. Hiding them there never hides them here.",
			es: "Las transacciones con fecha futura aparecen al inicio del registro, encima de hoy. Ocultarlas ahí nunca las oculta aquí.",
		}),
		"settings.upcoming.displayOnLog": t({
			en: "Display on Log Page",
			es: "Mostrar en el registro",
		}),
		"settings.upcoming.limitToSoon": t({
			en: "Limit to 14-Day Outlook",
			es: "Limitar a 14 días",
		}),
		"settings.upcoming.empty": t({
			en: "Nothing is scheduled ahead of today.",
			es: "No hay nada programado después de hoy.",
		}),
		"settings.stub.notAvailable": t({
			en: "Not available yet",
			es: "Aún no disponible",
		}),
		"settings.import.beforeYouStart": t({
			en: "Before you start",
			es: "Antes de comenzar",
		}),
		"settings.import.intro": t({
			en: "Pick a CSV and you will be asked which column holds what, how its dates are written, and which Outlayr category each of its category values means. Nothing is written until you have seen exactly what will land.",
			es: "Elige un CSV y se te preguntará qué contiene cada columna, cómo están escritas sus fechas y a qué categoría de Outlayr corresponde cada uno de sus valores de categoría. No se escribe nada hasta que hayas visto exactamente qué va a entrar.",
		}),
		"settings.import.restoreEyebrow": t({
			en: "Or restore everything",
			es: "O restaurar todo",
		}),
		"settings.import.restoreIntro": t({
			en: "A full archive replaces this ledger with the one in the file. Use it to move to a new phone, not to add entries.",
			es: "Un archivo completo reemplaza este registro por el del archivo. Sirve para pasar a un teléfono nuevo, no para agregar registros.",
		}),
		"settings.import.restoreAction": t({
			en: "Restore from an archive",
			es: "Restaurar desde un archivo",
		}),
		"settings.import.badArchiveTitle": t({
			en: "That is not an Outlayr archive",
			es: "Ese no es un archivo de Outlayr",
		}),
		"settings.import.badArchiveBody": t({
			en: "The file could not be read, or it was written by a newer version of the app.",
			es: "No se pudo leer el archivo, o lo escribió una versión más reciente de la app.",
		}),
		"settings.import.restoreConfirmTitle": t({
			en: "Replace this ledger?",
			es: "¿Reemplazar este registro?",
		}),
		"settings.import.restoreConfirmBody": t({
			en: "Everything on this device is replaced by the {count} rows in the archive. This cannot be undone.",
			es: "Todo lo de este dispositivo se reemplaza por las {count} filas del archivo. Esto no se puede deshacer.",
		}),
		"settings.import.restoreConfirm": t({
			en: "Replace",
			es: "Reemplazar",
		}),
		"settings.import.chooseAFile": t({
			en: "Choose a file",
			es: "Elegir un archivo",
		}),
		"settings.import.chooseCsvFile": t({
			en: "Choose CSV file",
			es: "Elegir archivo CSV",
		}),
		"settings.import.back": t({
			en: "Back",
			es: "Atrás",
		}),
		"settings.import.columnNumber": t({
			en: "Column {number}",
			es: "Columna {number}",
		}),
		"settings.import.untitledCategory": t({
			en: "Untitled",
			es: "Sin título",
		}),
		"settings.import.badFileTitle": t({
			en: "That file can't be used",
			es: "Ese archivo no se puede usar",
		}),
		"settings.import.badFileBody": t({
			en: "A CSV needs at least three columns and one row of data.",
			es: "Un CSV necesita al menos tres columnas y una fila de datos.",
		}),
		"settings.import.failedTitle": t({
			en: "Import failed",
			es: "Error al importar",
		}),
		"settings.import.failedBody": t({
			en: "That file couldn't be opened.",
			es: "No se pudo abrir ese archivo.",
		}),
		"settings.import.writeFailed": t({
			en: "Nothing was written. The ledger is unchanged.",
			es: "No se escribió nada. Tu registro queda igual.",
		}),
		"settings.import.writeFailedDetail": t({
			en: "The database reported: {detail}",
			es: "La base de datos informó: {detail}",
		}),
		"settings.import.step1": t({
			en: "Step 1 of 4 · {file}",
			es: "Paso 1 de 4 · {file}",
		}),
		"settings.import.mapIntro": t({
			en: "Say which column holds what. Date, Amount and Category are needed; the rest are optional.",
			es: "Indica qué contiene cada columna. Fecha, Monto y Categoría son obligatorias; el resto son opcionales.",
		}),
		"settings.import.slotDate": t({
			en: "Date",
			es: "Fecha",
		}),
		"settings.import.slotAmount": t({
			en: "Amount",
			es: "Monto",
		}),
		"settings.import.slotCategory": t({
			en: "Category",
			es: "Categoría",
		}),
		"settings.import.slotNote": t({
			en: "Note",
			es: "Nota",
		}),
		"settings.import.slotCurrency": t({
			en: "Currency",
			es: "Moneda",
		}),
		"settings.import.slotType": t({
			en: "Income / Expense",
			es: "Ingreso / Gasto",
		}),
		"settings.import.step2": t({
			en: "Step 2 of 4 · Dates and numbers",
			es: "Paso 2 de 4 · Fechas y números",
		}),
		"settings.import.datesRead": t({
			en: "{read} of {total} dates read with this pattern.",
			es: "{read} de {total} fechas se leen con este patrón.",
		}),
		"settings.import.sample": t({
			en: "Sample: {value}",
			es: "Muestra: {value}",
		}),
		"settings.import.tokens": t({
			en: "Tokens: yyyy, MM, dd, HH, mm, ss. Use ISO for a full 8601 instant — that is what Outlayr's own export writes.",
			es: "Tokens: yyyy, MM, dd, HH, mm, ss. Usa ISO para un instante 8601 completo — es lo que escribe la propia exportación de Outlayr.",
		}),
		"settings.import.decimalSeparator": t({
			en: "Decimal separator",
			es: "Separador decimal",
		}),
		"settings.import.step3": t({
			en: "Step 3 of 4 · Link categories",
			es: "Paso 3 de 4 · Vincular categorías",
		}),
		"settings.import.linkIntro": t({
			en: "{linked} of {total} linked. Rows whose category you leave unlinked are not imported — nothing is invented.",
			es: "{linked} de {total} vinculadas. Las filas cuya categoría dejes sin vincular no se importan — nada se inventa.",
		}),
		"settings.import.step4": t({
			en: "Step 4 of 4 · Review",
			es: "Paso 4 de 4 · Revisión",
		}),
		"settings.import.willAddOne": t({
			en: "transaction will be added",
			es: "transacción se agregará",
		}),
		"settings.import.willAddMany": t({
			en: "transactions will be added",
			es: "transacciones se agregarán",
		}),
		"settings.import.planRange": t({
			en: "Dated {from} to {to}.",
			es: "Con fechas del {from} al {to}.",
		}),
		"settings.import.allRowsRead": t({
			en: "Every row in the file could be read.",
			es: "Todas las filas del archivo se pudieron leer.",
		}),
		"settings.import.skippedCount": t({
			en: "{total} skipped",
			es: "{total} omitidas",
		}),
		"settings.import.skippedCategory": t({
			en: "unlinked category",
			es: "categoría sin vincular",
		}),
		"settings.import.skippedDate": t({
			en: "unreadable date",
			es: "fecha ilegible",
		}),
		"settings.import.skippedAmount": t({
			en: "unreadable amount",
			es: "monto ilegible",
		}),
		"settings.import.skippedNote": t({
			en: "Skipped rows are left out entirely. Go back to change the mapping, the date pattern, or the category links.",
			es: "Las filas omitidas se dejan fuera por completo. Vuelve atrás para cambiar la asignación, el patrón de fecha o los vínculos de categoría.",
		}),
		"settings.import.importCount": t({
			en: "Import {total}",
			es: "Importar {total}",
		}),
		"settings.import.writing": t({
			en: "Writing…",
			es: "Escribiendo…",
		}),
		"settings.import.imported": t({
			en: "Imported",
			es: "Importado",
		}),
		"settings.import.failed": t({
			en: "Failed",
			es: "Falló",
		}),
		"settings.import.addedOne": t({
			en: "transaction added to your ledger.",
			es: "transacción agregada a tu registro.",
		}),
		"settings.import.addedMany": t({
			en: "transactions added to your ledger.",
			es: "transacciones agregadas a tu registro.",
		}),
	},
} satisfies Dictionary;

export default settings;
