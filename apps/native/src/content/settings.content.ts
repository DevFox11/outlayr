import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const settings = {
    content: {
        "settings.about.copyright": t({
            en: "Copyright © 2022–2023 Rafael Soh and Dime contributors. Modifications copyright © 2026 Daniel Esteves.",
            es: "Copyright © 2022–2023 Rafael Soh y colaboradores de Dime. Modificaciones copyright © 2026 Daniel Esteves.",
        }),
        "settings.about.dimeRepo": t({
            en: "Dime (original project)",
            es: "Dime (proyecto original)",
        }),
        "settings.about.fork": t({
            en: "Outlayr is a modified version of Dime, forked in 2026 and changed since.",
            es: "Outlayr es una versión modificada de Dime: nació como fork en 2026 y ha cambiado desde entonces.",
        }),
        "settings.about.gplLink": t({
            en: "GPL-3.0 License",
            es: "Licencia GPL-3.0",
        }),
        "settings.about.intro": t({
            en: "Outlayr is open source and free forever. It is built on the foundation of Dime, a beautiful expense tracker created by Rafael Soh, and is distributed under the GNU General Public License v3.0.",
            es: "Outlayr es de código abierto y gratuito para siempre. Está basado en Dime, una hermosa app de gastos creada por Rafael Soh, y se distribuye bajo la GNU General Public License v3.0.",
        }),
        "settings.about.licenceHeading": t({
            en: "Licence",
            es: "Licencia",
        }),
        "settings.about.links": t({
            en: "Links",
            es: "Enlaces",
        }),
        "settings.about.logoDev": t({
            en: "Logos provided by Logo.dev",
            es: "Logos proporcionados por Logo.dev",
        }),
        "settings.about.openSourceLicenses": t({
            en: "Open source licenses",
            es: "Licencias de código abierto",
        }),
        "settings.about.outlayrRepo": t({
            en: "Outlayr on GitHub",
            es: "Outlayr en GitHub",
        }),
        "settings.about.version": t({
            en: "Version {version}",
            es: "Versión {version}",
        }),
        "settings.about.warranty": t({
            en: "Outlayr comes with ABSOLUTELY NO WARRANTY, to the extent permitted by law. You may redistribute it under the terms of the GNU General Public License v3.0.",
            es: "Outlayr se distribuye SIN NINGUNA GARANTÍA, en la medida permitida por la ley. Puedes redistribuirlo bajo los términos de la GNU General Public License v3.0.",
        }),
        "settings.account.checking": t({
            en: "Checking\u2026",
            es: "Verificando…",
        }),
        "settings.account.delete": t({
            en: "Delete account",
            es: "Eliminar cuenta",
        }),
        "settings.account.deleteConfirm": t({
            en: "Delete",
            es: "Eliminar",
        }),
        "settings.account.deleteConfirmBody": t({
            en: "Your account and everything synced to it are removed for good. The ledger on this device is not touched.",
            es: "Tu cuenta y todo lo sincronizado en ella se eliminan de forma definitiva. El registro de este dispositivo no se toca.",
        }),
        "settings.account.deleteConfirmTitle": t({
            en: "Delete this account?",
            es: "¿Eliminar esta cuenta?",
        }),
        "settings.account.deleteFooter": t({
            en: "Deletes your account and everything synced to it. The ledger on this device stays, and signing in again adopts it.",
            es: "Elimina tu cuenta y todo lo sincronizado en ella. El registro de este dispositivo se conserva y, si vuelves a iniciar sesión, se suma a tu cuenta.",
        }),
        "settings.account.deleteSection": t({
            en: "Deleting your account",
            es: "Eliminar tu cuenta",
        }),
        "settings.account.deleting": t({
            en: "Deleting…",
            es: "Eliminando…",
        }),
        "settings.account.eraseDevice": t({
            en: "Delete account and erase this device",
            es: "Eliminar cuenta y borrar este dispositivo",
        }),
        "settings.account.eraseDeviceConfirm": t({
            en: "Erase device",
            es: "Borrar dispositivo",
        }),
        "settings.account.eraseDeviceConfirmBody": t({
            en: "This permanently removes your account and all erasable Outlayr data on this device.",
            es: "Esto elimina de forma permanente tu cuenta y todos los datos borrables de Outlayr en este dispositivo.",
        }),
        "settings.account.eraseDeviceConfirmTitle": t({
            en: "Erase this device too?",
            es: "¿Borrar también este dispositivo?",
        }),
        "settings.account.eraseDeviceFooter": t({
            en: "Erases Outlayr data on this device after your cloud account is deleted. System permissions and widget placement remain controlled by the OS.",
            es: "Borra los datos de Outlayr de este dispositivo después de eliminar tu cuenta en la nube. Los permisos del sistema y la ubicación de los widgets siguen bajo control del sistema operativo.",
        }),
        "settings.account.eraseDeviceSection": t({
            en: "Erase this device",
            es: "Borrar este dispositivo",
        }),
        "settings.account.eyebrow": t({
            en: "Account",
            es: "Cuenta",
        }),
        "settings.account.genericFailure": t({
            en: "Sign-in didn't complete. Your ledger on this device is untouched.",
            es: "El inicio de sesi\u00F3n no se complet\u00F3. Tu registro en este dispositivo est\u00E1 intacto.",
        }),
        "settings.account.noProvider": t({
            en: "No sign-in provider is configured for this platform.",
            es: "No hay ning\u00FAn proveedor de inicio de sesi\u00F3n configurado para esta plataforma.",
        }),
        "settings.account.notSignedIn": t({
            en: "Not signed in",
            es: "No has iniciado sesión",
        }),
        "settings.account.playServices": t({
            en: "Google Play services are unavailable on this device.",
            es: "Los servicios de Google Play no est\u00E1n disponibles en este dispositivo.",
        }),
        "settings.account.resetFailedTitle": t({
            en: "Device cleanup needs attention",
            es: "La limpieza del dispositivo necesita atención",
        }),
        "settings.account.rowTitle": t({
            en: "Account",
            es: "Cuenta",
        }),
        "settings.account.sectionTitle": t({
            en: "Account",
            es: "Cuenta",
        }),
        "settings.account.signInFooter": t({
            en: "Signing in does not change your ledger. It lets you choose whether to sync this device with your account.",
            es: "Iniciar sesión no cambia tu registro. Te permite elegir si quieres sincronizar este dispositivo con tu cuenta.",
        }),
        "settings.account.signInSection": t({
            en: "Sign in",
            es: "Iniciar sesi\u00F3n",
        }),
        "settings.account.signOut": t({
            en: "Sign Out",
            es: "Cerrar sesi\u00F3n",
        }),
        "settings.account.signOutFooter": t({
            en: "Signing out ends the session on this iPhone. Every transaction, budget and category stays exactly where it is.",
            es: "Cerrar sesión solo afecta a este iPhone. Tus transacciones, presupuestos y categorías se quedan tal como están.",
        }),
        "settings.account.signedInAs": t({
            en: "Signed in as",
            es: "Sesi\u00F3n iniciada como",
        }),
        "settings.account.signedInFallback": t({
            en: "Signed in",
            es: "Sesi\u00F3n iniciada",
        }),
        "settings.account.signedOutDetail": t({
            en: "Outlayr keeps your ledger on this device and behaves exactly the same signed out. An account lets you choose to sync it with your other devices.",
            es: "Outlayr guarda tu registro en este dispositivo y funciona igual sin sesión. Con una cuenta, puedes sincronizarlo con tus otros dispositivos si quieres.",
        }),
        "settings.account.signingOut": t({
            en: "Signing out\u2026",
            es: "Cerrando sesi\u00F3n\u2026",
        }),
        "settings.account.unavailable": t({
            en: "Cloud features unavailable",
            es: "Funciones en la nube no disponibles",
        }),
        "settings.account.unavailableDetail": t({
            en: "This build is not configured for cloud features. Your ledger remains available on this device.",
            es: "Esta compilaci\u00F3n no est\u00E1 configurada para funciones en la nube. Tu registro sigue disponible en este dispositivo.",
        }),
        "settings.appIcon.alertNote": t({
            en: "iOS confirms every change with an alert of its own.",
            es: "iOS confirma cada cambio con su propia alerta.",
        }),
        "settings.appIcon.failedBody": t({
            en: "iOS refused the change. Your home screen still shows the icon marked here.",
            es: "iOS rechazó el cambio. Tu pantalla de inicio sigue mostrando el ícono marcado aquí.",
        }),
        "settings.appIcon.failedTitle": t({
            en: "Icon unchanged",
            es: "El ícono no cambió",
        }),
        "settings.appIcon.section": t({
            en: "Home screen",
            es: "Pantalla de inicio",
        }),
        "settings.appIcon.unsupported": t({
            en: "This device does not allow the app icon to be changed.",
            es: "Este dispositivo no permite cambiar el ícono de la app.",
        }),
        "settings.colorScheme.dark": t({
            en: "Dark",
            es: "Oscuro",
        }),
        "settings.colorScheme.darkDetail": t({
            en: "Always dark, whatever the device does.",
            es: "Siempre oscuro, sin importar tu dispositivo.",
        }),
        "settings.colorScheme.light": t({
            en: "Light",
            es: "Claro",
        }),
        "settings.colorScheme.lightDetail": t({
            en: "Always light, whatever the device does.",
            es: "Siempre claro, sin importar tu dispositivo.",
        }),
        "settings.colorScheme.system": t({
            en: "System",
            es: "Sistema",
        }),
        "settings.colorScheme.systemDetail": t({
            en: "Follows your device.",
            es: "Igual que tu dispositivo.",
        }),
        "settings.currency.all": t({
            en: "All currencies",
            es: "Todas las monedas",
        }),
        "settings.currency.favourite": t({
            en: "Add {code} to favourites",
            es: "Agregar {code} a favoritas",
        }),
        "settings.currency.favouriteAction": t({
            en: "Favourite",
            es: "Favorita",
        }),
        "settings.currency.favouriteFailedBody": t({
            en: "Your favourites were not changed.",
            es: "Tus favoritas no se cambiaron.",
        }),
        "settings.currency.favouriteFailedTitle": t({
            en: "Couldn't save that",
            es: "No se pudo guardar",
        }),
        "settings.currency.favourites": t({
            en: "Favourites",
            es: "Favoritas",
        }),
        "settings.currency.favouritesFull": t({
            en: "Favourites full ({limit})",
            es: "Favoritas al límite ({limit})",
        }),
        "settings.currency.favouritesFullBody": t({
            en: "Remove one to make room.",
            es: "Quita una para hacer espacio.",
        }),
        "settings.currency.favouritesFullShort": t({
            en: "Full ({limit})",
            es: "Al límite ({limit})",
        }),
        "settings.currency.favouritesHint": t({
            en: "Hold a currency to keep it here.",
            es: "Mantén presionada una moneda para guardarla aquí.",
        }),
        "settings.currency.search": t({
            en: "Search currencies",
            es: "Buscar monedas",
        }),
        "settings.currency.unfavourite": t({
            en: "Remove {code} from favourites",
            es: "Quitar {code} de favoritas",
        }),
        "settings.currency.unfavouriteAction": t({
            en: "Unfavourite",
            es: "Quitar",
        }),
        "settings.currency.use": t({
            en: "Use {code}",
            es: "Usar {code}",
        }),
        "settings.deleted.deletedOn": t({
            en: "Deleted {date}",
            es: "Eliminada {date}",
        }),
        "settings.deleted.empty": t({
            en: "Nothing has been deleted. Entries you delete arrive here and wait — Outlayr never throws one away.",
            es: "No has eliminado nada. Las entradas que elimines llegan aquí y te esperan. Outlayr nunca descarta ninguna.",
        }),
        "settings.deleted.failedBody": t({
            en: "It is still here and nothing was lost. Try restoring it again.",
            es: "Sigue aquí y no se perdió nada. Intenta restaurarla de nuevo.",
        }),
        "settings.deleted.failedTitle": t({
            en: "Entry not restored",
            es: "La entrada no se restauró",
        }),
        "settings.deleted.footer": t({
            en: "Restoring puts the entry back on the Log exactly where its date belongs. A subscription you ended stays ended: only the charge comes back, never the schedule.",
            es: "Restaurar devuelve la entrada al registro justo donde le corresponde por fecha. Una suscripción que terminaste sigue terminada: vuelve solo el cargo, nunca la programación.",
        }),
        "settings.deleted.navTitle": t({
            en: "Recently Deleted",
            es: "Eliminados recientemente",
        }),
        "settings.deleted.restore": t({
            en: "Restore",
            es: "Restaurar",
        }),
        "settings.deleted.restoreEntry": t({
            en: "Restore {note}",
            es: "Restaurar {note}",
        }),
        "settings.deleted.section": t({
            en: "Deleted entries",
            es: "Entradas eliminadas",
        }),
        "settings.erase.action": t({
            en: "Erase",
            es: "Borrar",
        }),
        "settings.erase.confirmEverythingBody": t({
            en: "Every transaction, recurring template and budget will be deleted. Only your categories are kept. This can't be undone.",
            es: "Se eliminarán todas las transacciones, plantillas recurrentes y presupuestos. Solo se conservan tus categorías. Esto no se puede deshacer.",
        }),
        "settings.erase.confirmEverythingTitle": t({
            en: "Erase everything?",
            es: "¿Borrar todo?",
        }),
        "settings.erase.confirmTransactionsBody": t({
            en: "Every transaction and recurring template will be deleted. Budgets and categories are kept. This can't be undone.",
            es: "Se eliminarán todas las transacciones y plantillas recurrentes. Los presupuestos y las categorías se conservan. Esto no se puede deshacer.",
        }),
        "settings.erase.confirmTransactionsTitle": t({
            en: "Erase transactions?",
            es: "¿Borrar las transacciones?",
        }),
        "settings.erase.failedBody": t({
            en: "Part of your data may still be on this device. Try erasing again.",
            es: "Parte de tus datos podría seguir en este dispositivo. Intenta borrar de nuevo.",
        }),
        "settings.erase.failedTitle": t({
            en: "Erase didn't finish",
            es: "El borrado no terminó",
        }),
        "settings.erase.footer": t({
            en: "Your categories are kept either way — they are the vocabulary you built, not the records you logged.",
            es: "Tus categorías se conservan en ambos casos: son el vocabulario que armaste, no los registros que anotaste.",
        }),
        "settings.erase.onThisDevice": t({
            en: "On this device",
            es: "En este dispositivo",
        }),
        "settings.erase.section": t({
            en: "Erase",
            es: "Borrar",
        }),
        "settings.erase.transactionLogged": t({
            en: "transaction logged",
            es: "transacción registrada",
        }),
        "settings.erase.transactionsAndBudgets": t({
            en: "Transactions and budgets",
            es: "Transacciones y presupuestos",
        }),
        "settings.erase.transactionsLogged": t({
            en: "transactions logged",
            es: "transacciones registradas",
        }),
        "settings.erase.transactionsOnly": t({
            en: "Transactions only",
            es: "Solo las transacciones",
        }),
        "settings.export.action": t({
            en: "Export CSV",
            es: "Exportar CSV",
        }),
        "settings.export.archiveAction": t({
            en: "Export a full archive",
            es: "Exportar un archivo completo",
        }),
        "settings.export.archiveNote": t({
            en: "Carries every entry, category and budget in full, including the things the CSV leaves behind. This is the file to restore from.",
            es: "Incluye cada registro, categoría y presupuesto completos, con todo lo que el CSV deja fuera. Es el archivo que usas para restaurar.",
        }),
        "settings.export.archiveShareTitle": t({
            en: "Outlayr archive",
            es: "Archivo de Outlayr",
        }),
        "settings.export.archiveTitle": t({
            en: "Full archive",
            es: "Archivo completo",
        }),
        "settings.export.columns": t({
            en: "Columns",
            es: "Columnas",
        }),
        "settings.export.columnsNote": t({
            en: "Dates are ISO 8601 instants and amounts are plain decimals with no grouping, so the file reads back into Outlayr — or into a spreadsheet — as the same figures.",
            es: "Las fechas van en formato ISO 8601 y los montos como decimales simples sin separador de miles, así que el archivo se vuelve a leer en Outlayr (o en una hoja de cálculo) con las mismas cifras.",
        }),
        "settings.export.failedBody": t({
            en: "The file couldn't be written.",
            es: "No se pudo escribir el archivo.",
        }),
        "settings.export.failedTitle": t({
            en: "Export failed",
            es: "Error al exportar",
        }),
        "settings.export.footer": t({
            en: "Deleted transactions are left out. Every other transaction is written, newest first — six columns of it.",
            es: "Las transacciones eliminadas se omiten. Todas las demás se escriben, de la más reciente a la más antigua, en seis columnas.",
        }),
        "settings.export.omitted": t({
            en: "Not in the file",
            es: "No está en el archivo",
        }),
        "settings.export.omittedDetails": t({
            en: "Notes — the longer text under a transaction",
            es: "Notas: el texto largo debajo de una transacción",
        }),
        "settings.export.omittedLook": t({
            en: "Emoji, icon and color",
            es: "Emoji, ícono y color",
        }),
        "settings.export.omittedNote": t({
            en: "A CSV is a readable copy of your figures, not a backup. Reading one back in re-creates only the date, name, amount, currency and type of each transaction, and every category has to be linked by hand — the file cannot create one. Your budgets, your categories and everything listed above live only on this device.",
            es: "Un CSV es una copia legible de tus cifras, no un respaldo. Al volver a importarlo solo se recrean la fecha, el nombre, el monto, la moneda y el tipo de cada transacción, y cada categoría se tiene que vincular a mano, porque el archivo no puede crearla. Tus presupuestos, tus categorías y todo lo anterior existen únicamente en este dispositivo.",
        }),
        "settings.export.omittedPhotos": t({
            en: "Photos",
            es: "Fotos",
        }),
        "settings.export.omittedRecurrence": t({
            en: "Subscription schedules and their reminders",
            es: "La programación de las suscripciones y sus recordatorios",
        }),
        "settings.export.preparing": t({
            en: "Preparing the file\u2026",
            es: "Preparando el archivo\u2026",
        }),
        "settings.export.preparingArchive": t({
            en: "Preparing the archive\u2026",
            es: "Preparando el archivo completo\u2026",
        }),
        "settings.export.ready": t({
            en: "Ready to export",
            es: "Listo para exportar",
        }),
        "settings.export.shareTitle": t({
            en: "Export transactions",
            es: "Exportar transacciones",
        }),
        "settings.export.transaction": t({
            en: "transaction",
            es: "transacción",
        }),
        "settings.export.transactions": t({
            en: "transactions",
            es: "transacciones",
        }),
        "settings.featureLab.addingSection": t({
            en: "Adding a transaction",
            es: "Al agregar una transacción",
        }),
        "settings.featureLab.aiEnrichment": t({
            en: "Suggest Category and Tags",
            es: "Sugerir categoría y etiquetas",
        }),
        "settings.featureLab.aiEnrichmentNote": t({
            en: "Well-known services are recognised on this device, and only their web address goes to a logo service to fetch the logo. For anything else, only the merchant name of an entry (typed, spoken, scanned or logged from Wallet), whether it is an expense or income, its currency code, your language and device region, and your own category names leave the device — never amounts, dates or accounts — and the web address that comes back goes to the same logo service. A recent entry saved without a logo is looked up again in the background.",
            es: "Los servicios conocidos se reconocen en este dispositivo, y solo su dirección web va a un servicio de logos para traer el logo. Para todo lo demás, solo salen del dispositivo el nombre del comercio de una entrada (escrita, dictada, escaneada o registrada desde Wallet), si es gasto o ingreso, su código de moneda, tu idioma y la región del dispositivo, y los nombres de tus categorías. Nunca montos, fechas ni cuentas. La dirección web que vuelve va al mismo servicio de logos. Si una entrada reciente se guardó sin logo, se vuelve a buscar en segundo plano.",
        }),
        "settings.featureLab.aiSection": t({
            en: "Smart fill",
            es: "Autocompletado",
        }),
        "settings.featureLab.budgetRows": t({
            en: "Budget Rows",
            es: "Filas de presupuesto",
        }),
        "settings.featureLab.budgetRowsNote": t({
            en: "Off lays the budgets out as a two-up grid of cards instead of a list.",
            es: "Si lo desactivas, los presupuestos se muestran en una cuadrícula de tarjetas de dos en dos en vez de una lista.",
        }),
        "settings.featureLab.budgetsSection": t({
            en: "Budgets",
            es: "Presupuestos",
        }),
        "settings.featureLab.confetti": t({
            en: "Celebrate Expenses",
            es: "Celebrar gastos",
        }),
        "settings.featureLab.confettiNote": t({
            en: "Throws confetti over a transaction the moment you add it.",
            es: "Lanza confeti sobre una transacción en el momento en que la agregas.",
        }),
        "settings.featureLab.experimental": t({
            en: "Experimental — these can change or disappear.",
            es: "Experimental: esto puede cambiar o desaparecer.",
        }),
        "settings.featureLab.groundedLookup": t({
            en: "Look Up New Merchants",
            es: "Buscar comercios nuevos",
        }),
        "settings.featureLab.groundedLookupNote": t({
            en: "For a merchant nobody has seen before, the name, whether it is an expense or income, the entry's currency code and your language and device region may be searched on the web to learn its category — never on the transaction you're entering, and never with any amount, date or account. Off keeps every lookup on this device and the ones already known.",
            es: "Para un comercio que nadie ha visto antes, el nombre, si es gasto o ingreso, el código de moneda de la entrada y tu idioma y región pueden buscarse en la web para conocer su categoría. Nunca para la transacción que estás ingresando y nunca con montos, fechas ni cuentas. Si lo desactivas, cada búsqueda se queda en este dispositivo y en los comercios ya conocidos.",
        }),
        "settings.featureLab.lineGraph": t({
            en: "Show Line Graph",
            es: "Mostrar gráfico de líneas",
        }),
        "settings.featureLab.logSection": t({
            en: "The Log",
            es: "El registro",
        }),
        "settings.featureLab.swapTime": t({
            en: "Replace Time Label",
            es: "Reemplazar etiqueta de hora",
        }),
        "settings.featureLab.swapTimeNote": t({
            en: "Each transaction shows its category instead of its time. If you never write your own note, the note is already the category name, so both lines will read the same.",
            es: "Cada transacción muestra su categoría en vez de su hora. Si nunca escribes tu propia nota, la nota ya es el nombre de la categoría, así que ambas líneas dirán lo mismo.",
        }),
        "settings.featureLab.transactionRowsSection": t({
            en: "Transaction rows",
            es: "Filas de transacción",
        }),
        "settings.haptics.excessive": t({
            en: "Excessive",
            es: "Excesiva",
        }),
        "settings.haptics.excessiveDetail": t({
            en: "A tap for every action.",
            es: "Un toque en cada acción.",
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
        "settings.import.sourceClipboardSubtitle": t({
            en: "Transactions copied from another app.",
            es: "Transacciones copiadas de otra app.",
        }),
        "settings.import.sourceClipboardTitle": t({
            en: "Paste from clipboard",
            es: "Pegar del portapapeles",
        }),
        "settings.import.sourceCsvSubtitle": t({
            en: "Comma-separated values from your bank.",
            es: "Valores separados por comas de tu banco.",
        }),
        "settings.import.sourceCsvTitle": t({
            en: "CSV file",
            es: "Archivo CSV",
        }),
        "settings.import.sourceScreenshotSubtitle": t({
            en: "A screenshot of a statement or receipt.",
            es: "Una captura de un estado de cuenta o recibo.",
        }),
        "settings.import.sourceScreenshotTitle": t({
            en: "Import from a screenshot",
            es: "Importar desde una captura",
        }),
        "settings.lock.alertTitle": t({
            en: "Authentication",
            es: "Autenticación",
        }),
        "settings.lock.promptOff": t({
            en: "Turn off authentication",
            es: "Desactivar la autenticación",
        }),
        "settings.lock.promptOn": t({
            en: "Turn on authentication",
            es: "Activar la autenticación",
        }),
        "settings.notifications.custom": t({
            en: "Custom time",
            es: "Hora personalizada",
        }),
        "settings.notifications.deniedBody": t({
            en: "Outlayr cannot ask again once you have declined. Turn notifications on for Outlayr in iOS Settings and this switch will follow.",
            es: "Como ya las rechazaste, Outlayr no puede volver a preguntarte. Activa las notificaciones de Outlayr en Configuración y este interruptor se actualizará solo.",
        }),
        "settings.notifications.deniedTitle": t({
            en: "Notifications are off",
            es: "Las notificaciones están desactivadas",
        }),
        "settings.notifications.evening": t({
            en: "Every evening",
            es: "Cada noche",
        }),
        "settings.notifications.eveningDetail": t({
            en: "A nudge at {time}, once the day is mostly done.",
            es: "Un aviso a las {time}, cuando el día ya casi termina.",
        }),
        "settings.notifications.footer": t({
            en: "One reminder a day, from this device. Outlayr never sends anything from a server.",
            es: "Un recordatorio al día, desde este dispositivo. Outlayr nunca envía nada desde un servidor.",
        }),
        "settings.notifications.morning": t({
            en: "Every morning",
            es: "Cada mañana",
        }),
        "settings.notifications.morningDetail": t({
            en: "A nudge at {time}, before the day has spent anything.",
            es: "Un aviso a las {time}, antes de que hayas gastado algo.",
        }),
        "settings.notifications.nextAt": t({
            en: "Next reminder at {time}.",
            es: "Próximo recordatorio a las {time}.",
        }),
        "settings.notifications.notNow": t({
            en: "Not now",
            es: "Ahora no",
        }),
        "settings.notifications.openSettings": t({
            en: "Open Settings",
            es: "Abrir Configuración",
        }),
        "settings.notifications.section": t({
            en: "Daily reminder",
            es: "Recordatorio diario",
        }),
        "settings.notifications.subscriptionFooter": t({
            en: "Each subscription decides how far ahead it warns you, on its own screen. Off silences all of them without changing what any one of them says.",
            es: "Cada suscripción define en su propia pantalla con cuánta anticipación te avisa. Si lo desactivas, se silencian todas sin cambiar su configuración.",
        }),
        "settings.notifications.subscriptionSection": t({
            en: "Subscription charges",
            es: "Cobros de suscripciones",
        }),
        "settings.notifications.subscriptionToggle": t({
            en: "Warn Me Before a Charge",
            es: "Avísame antes de un cobro",
        }),
        "settings.notifications.time": t({
            en: "Time",
            es: "Hora",
        }),
        "settings.notifications.toggle": t({
            en: "Remind Me to Log",
            es: "Recuérdame registrar",
        }),
        "settings.notifications.whenSection": t({
            en: "When",
            es: "Cuándo",
        }),
        "settings.numberEntry.type1": t({
            en: "Type 1",
            es: "Tipo 1",
        }),
        "settings.numberEntry.type1Detail": t({
            en: "The last two digits are cents. Type 1234 to get {example}.",
            es: "Los dos últimos dígitos son centavos. Escribe 1234 para obtener {example}.",
        }),
        "settings.numberEntry.type2": t({
            en: "Type 2",
            es: "Tipo 2",
        }),
        "settings.numberEntry.type2Detail": t({
            en: "Type the decimal point yourself. {example} stays {example}.",
            es: "Escribe tú los decimales. {example} se queda en {example}.",
        }),
        "settings.restore.action": t({
            en: "Restore from an archive",
            es: "Restaurar desde un archivo",
        }),
        "settings.restore.badArchiveBody": t({
            en: "The file could not be read, or it was written by a newer version of the app.",
            es: "No se pudo leer el archivo, o lo escribió una versión más reciente de la app.",
        }),
        "settings.restore.badArchiveTitle": t({
            en: "That is not an Outlayr archive",
            es: "Ese no es un archivo de Outlayr",
        }),
        "settings.restore.confirmAction": t({
            en: "Replace",
            es: "Reemplazar",
        }),
        "settings.restore.confirmBody": t({
            en: "Everything on this device is replaced by the {count} rows in the archive. This cannot be undone.",
            es: "Todo lo de este dispositivo se reemplaza por las {count} filas del archivo. Esto no se puede deshacer.",
        }),
        "settings.restore.confirmTitle": t({
            en: "Replace this ledger?",
            es: "¿Reemplazar este registro?",
        }),
        "settings.restore.eyebrow": t({
            en: "Restore everything",
            es: "Restaurar todo",
        }),
        "settings.restore.failedBody": t({
            en: "That file couldn't be opened.",
            es: "No se pudo abrir ese archivo.",
        }),
        "settings.restore.failedTitle": t({
            en: "Restore failed",
            es: "Error al restaurar",
        }),
        "settings.restore.footer": t({
            en: "This replaces every transaction, category and budget on this device. It cannot be undone.",
            es: "Esto reemplaza cada transacción, categoría y presupuesto de este dispositivo. No se puede deshacer.",
        }),
        "settings.restore.intro": t({
            en: "A full archive replaces this ledger with the one in the file. Use it to move to a new phone, not to add entries.",
            es: "Un archivo completo reemplaza este registro por el del archivo. Sirve para pasarte a un celular nuevo, no para agregar registros.",
        }),
        "settings.restore.restoring_one": t({
            en: "Restoring {count} row\u2026",
            es: "Restaurando {count} fila\u2026",
        }),
        "settings.restore.restoring_other": t({
            en: "Restoring {count} rows\u2026",
            es: "Restaurando {count} filas\u2026",
        }),
        "settings.row.about": t({
            en: "About & Credits",
            es: "Acerca de y créditos",
        }),
        "settings.row.accounts": t({
            en: "Accounts",
            es: "Cuentas",
        }),
        "settings.row.animatedCharts": t({
            en: "Animated Charts",
            es: "Gráficos animados",
        }),
        "settings.row.appIcon": t({
            en: "App Icon",
            es: "Ícono de la app",
        }),
        "settings.row.authentication": t({
            en: "Authentication",
            es: "Autenticación",
        }),
        "settings.row.categories": t({
            en: "Categories",
            es: "Categorías",
        }),
        "settings.row.colorScheme": t({
            en: "Color Scheme",
            es: "Esquema de color",
        }),
        "settings.row.currency": t({
            en: "Currency",
            es: "Moneda",
        }),
        "settings.row.deleted": t({
            en: "Recently Deleted",
            es: "Eliminados recientemente",
        }),
        "settings.row.displayCents": t({
            en: "Display Cents",
            es: "Mostrar centavos",
        }),
        "settings.row.erase": t({
            en: "Erase Data",
            es: "Borrar datos",
        }),
        "settings.row.export": t({
            en: "Export Data",
            es: "Exportar datos",
        }),
        "settings.row.featureLab": t({
            en: "Feature Lab",
            es: "Laboratorio de funciones",
        }),
        "settings.row.featureRequest": t({
            en: "Feature Request",
            es: "Sugerir una función",
        }),
        "settings.row.followX": t({
            en: "Follow Outlayr on X",
            es: "Sigue a Outlayr en X",
        }),
        "settings.row.haptics": t({
            en: "Haptics",
            es: "Vibración",
        }),
        "settings.row.import": t({
            en: "Import Data",
            es: "Importar datos",
        }),
        "settings.row.incomeTracking": t({
            en: "Income Tracking",
            es: "Seguimiento de ingresos",
        }),
        "settings.row.language": t({
            en: "Language",
            es: "Idioma",
        }),
        "settings.row.notifications": t({
            en: "Notifications",
            es: "Notificaciones",
        }),
        "settings.row.numberEntry": t({
            en: "Number Entry",
            es: "Escritura de montos",
        }),
        "settings.row.rate": t({
            en: "Rate on App Store",
            es: "Califícanos en el App Store",
        }),
        "settings.row.reportBug": t({
            en: "Report Bug",
            es: "Reportar un error",
        }),
        "settings.row.restore": t({
            en: "Restore Data",
            es: "Restaurar datos",
        }),
        "settings.row.share": t({
            en: "Share with Friends",
            es: "Comparte con amigos",
        }),
        "settings.row.sync": t({
            en: "Sync",
            es: "Sincronización",
        }),
        "settings.row.theme": t({
            en: "Theme",
            es: "Tema",
        }),
        "settings.row.timeFrames": t({
            en: "Time Frames",
            es: "Períodos de tiempo",
        }),
        "settings.row.upcoming": t({
            en: "Upcoming Logs",
            es: "Próximos registros",
        }),
        "settings.row.wallet": t({
            en: "Apple Pay",
            es: "Apple Pay",
        }),
        "settings.screenTitle": t({
            en: "Settings",
            es: "Configuración",
        }),
        "settings.section.about": t({
            en: "About Outlayr",
            es: "Acerca de Outlayr",
        }),
        "settings.section.account": t({
            en: "Account",
            es: "Cuenta",
        }),
        "settings.section.appearance": t({
            en: "Appearance",
            es: "Apariencia",
        }),
        "settings.section.data": t({
            en: "Your data",
            es: "Tus datos",
        }),
        "settings.section.device": t({
            en: "This device",
            es: "Este dispositivo",
        }),
        "settings.section.ledger": t({
            en: "Your ledger",
            es: "Tu registro",
        }),
        "settings.section.money": t({
            en: "Money",
            es: "Dinero",
        }),
        "settings.share.message": t({
            en: "Track your money with Outlayr — {url}",
            es: "Controla tu dinero con Outlayr: {url}",
        }),
        "settings.support.bugSubject": t({
            en: "Support Email",
            es: "Correo de soporte",
        }),
        "settings.support.featureSubject": t({
            en: "Feature Request",
            es: "Solicitud de función",
        }),
        "settings.sync.eyebrow": t({
            en: "This device",
            es: "Este dispositivo",
        }),
        "settings.sync.failedBody": t({
            en: "The switch is where it was and your ledger is untouched. Try again in a moment.",
            es: "El interruptor sigue como estaba y tu registro está intacto. Inténtalo de nuevo en un momento.",
        }),
        "settings.sync.failedTitle": t({
            en: "Sync setting unchanged",
            es: "La sincronización no cambió",
        }),
        "settings.sync.footer": t({
            en: "Turning sync off keeps every transaction, budget and category on this iPhone — it only stops queueing them for your account. Turning it back on hands over everything logged in between.",
            es: "Si desactivas la sincronización, cada transacción, presupuesto y categoría se queda en este iPhone; solo deja de enviarse a tu cuenta. Al activarla de nuevo, se envía todo lo que registraste mientras tanto.",
        }),
        "settings.sync.lastSynced": t({
            en: "Last synced",
            es: "Última sincronización",
        }),
        "settings.sync.navTitle": t({
            en: "Sync",
            es: "Sincronización",
        }),
        "settings.sync.needsAccount": t({
            en: "Sync needs an account to replicate to. Until you sign in your ledger stays on this device, which is all Outlayr ever needed to work.",
            es: "Para sincronizar necesitas una cuenta. Hasta que inicies sesión, tu registro se queda en este dispositivo, y eso es todo lo que Outlayr necesita para funcionar.",
        }),
        "settings.sync.never": t({
            en: "Not synced yet",
            es: "Aún sin sincronizar",
        }),
        "settings.sync.neverSynced": t({
            en: "Never",
            es: "Nunca",
        }),
        "settings.sync.off": t({
            en: "Not syncing",
            es: "Sin sincronizar",
        }),
        "settings.sync.offDetail": t({
            en: "Nothing leaves this iPhone. Your ledger is complete here and works exactly as it does now.",
            es: "Nada sale de este iPhone. Tu registro está completo aquí y funciona igual que ahora.",
        }),
        "settings.sync.on": t({
            en: "Syncing",
            es: "Sincronizando",
        }),
        "settings.sync.onDetail": t({
            en: "Every change you make here is queued for your account and reaches your other devices.",
            es: "Cada cambio que haces aquí se pone en cola para tu cuenta y llega a tus otros dispositivos.",
        }),
        "settings.sync.paused": t({
            en: "Paused",
            es: "En pausa",
        }),
        "settings.sync.pausedDetail": t({
            en: "Syncing needs Outlayr Pro. Your ledger is complete on this iPhone and keeps working; changes wait here until Pro is active again.",
            es: "Sincronizar requiere Outlayr Pro. Tu registro está completo en este iPhone y sigue funcionando; los cambios esperan aquí hasta que Pro esté activo otra vez.",
        }),
        "settings.sync.pending": t({
            en: "{count} waiting to sync",
            es: "{count} por sincronizar",
        }),
        "settings.sync.pendingOne": t({
            en: "1 waiting to sync",
            es: "1 por sincronizar",
        }),
        "settings.sync.section": t({
            en: "Replication",
            es: "Replicación",
        }),
        "settings.sync.statusSection": t({
            en: "Status",
            es: "Estado",
        }),
        "settings.sync.toggle": t({
            en: "Sync this device",
            es: "Sincronizar este dispositivo",
        }),
        "settings.sync.upToDate": t({
            en: "Up to date",
            es: "Al día",
        }),
        "settings.sync.waiting": t({
            en: "Waiting to sync",
            es: "Por sincronizar",
        }),
        "settings.sync.working": t({
            en: "Working…",
            es: "Procesando…",
        }),
        "settings.theme.ochre": t({
            en: "Ochre",
            es: "Ocre",
        }),
        "settings.theme.pine": t({
            en: "Pine",
            es: "Pino",
        }),
        "settings.theme.plum": t({
            en: "Plum",
            es: "Ciruela",
        }),
        "settings.theme.prussian": t({
            en: "Prussian",
            es: "Azul de Prusia",
        }),
        "settings.theme.vermilion": t({
            en: "Vermilion",
            es: "Bermellón",
        }),
        "settings.time.dayOfMonth": t({
            en: "{day} of month",
            es: "día {day} del mes",
        }),
        "settings.time.monday": t({
            en: "Monday",
            es: "Lunes",
        }),
        "settings.time.monthSection": t({
            en: "Start of Month",
            es: "Inicio del mes",
        }),
        "settings.time.reopenNote": t({
            en: "Close and reopen the app for the month start to take full effect.",
            es: "Cierra y vuelve a abrir la app para que el nuevo inicio de mes se aplique por completo.",
        }),
        "settings.time.startsSection": t({
            en: "Starts on",
            es: "Empieza en",
        }),
        "settings.time.sunday": t({
            en: "Sunday",
            es: "Domingo",
        }),
        "settings.time.weekSection": t({
            en: "Start of Week",
            es: "Inicio de la semana",
        }),
        "settings.upcoming.displayOnLog": t({
            en: "Display on Log Page",
            es: "Mostrar en el registro",
        }),
        "settings.upcoming.empty": t({
            en: "Nothing is scheduled ahead of today.",
            es: "No hay nada programado después de hoy.",
        }),
        "settings.upcoming.footer": t({
            en: "Transactions dated in the future sit at the top of the Log, above today. Hiding them there never hides them here.",
            es: "Las transacciones con fecha futura aparecen al inicio del registro, encima de hoy. Ocultarlas ahí nunca las oculta aquí.",
        }),
        "settings.upcoming.limitToSoon": t({
            en: "Limit to 14-Day Outlook",
            es: "Limitar a 14 días",
        }),
        "settings.upcoming.section": t({
            en: "On the Log",
            es: "En el registro",
        }),
        "settings.usage.captures": t({
            en: "of {count} captures",
            es: "de {count} capturas",
        }),
        "settings.usage.capturesKinds": t({
            en: "Voice and receipts",
            es: "Voz y recibos",
        }),
        "settings.usage.fullIn": t({
            en: "Full in {time}",
            es: "Se recarga en {time}",
        }),
        "settings.usage.imports": t({
            en: "CSV imports",
            es: "Importaciones CSV",
        }),
        "settings.usage.left": t({
            en: "{count} left",
            es: "Quedan {count}",
        }),
        "settings.usage.receipts": t({
            en: "Receipt scans",
            es: "Escaneos de recibos",
        }),
        "settings.usage.resets": t({
            en: "Resets {date}",
            es: "Se reinicia el {date}",
        }),
        "settings.usage.suggestions": t({
            en: "Suggestions",
            es: "Sugerencias",
        }),
        "settings.usage.thisHour": t({
            en: "This hour",
            es: "En esta hora",
        }),
        "settings.usage.toast.empty": t({
            en: "No captures left",
            es: "No te quedan capturas",
        }),
        "settings.usage.toast.last": t({
            en: "That was your last capture",
            es: "Esa fue tu última captura",
        }),
        "settings.usage.toast.moreOn": t({
            en: "{count} more on {date}",
            es: "{count} más el {date}",
        }),
        "settings.usage.toast.pro": t({
            en: "Pro",
            es: "Pro",
        }),
        "settings.usage.toast.usage": t({
            en: "Usage",
            es: "Uso",
        }),
        "settings.usage.voice": t({
            en: "Voice",
            es: "Voz",
        }),
        "settings.wallet.accountsFooter": t({
            en: "Name an account like its card in Wallet. A card that matches none still logs, unattached.",
            es: "Ponle a la cuenta el mismo nombre que tiene su tarjeta en Wallet. Si una tarjeta no coincide con ninguna, igual se registra, sin cuenta.",
        }),
        "settings.wallet.accountsSection": t({
            en: "Cards match these accounts",
            es: "Las tarjetas coinciden con estas cuentas",
        }),
        "settings.wallet.automationDetail": t({
            en: "Wallet trigger runs Outlayr - Apple Pay",
            es: "El disparador de Wallet ejecuta Outlayr - Apple Pay",
        }),
        "settings.wallet.automationDetailInline": t({
            en: "Wallet trigger runs Log a Wallet Transaction",
            es: "El disparador de Wallet ejecuta Log a Wallet Transaction",
        }),
        "settings.wallet.automationRow": t({
            en: "Automation in Shortcuts",
            es: "Automatización en Atajos",
        }),
        "settings.wallet.get": t({
            en: "Get the shortcut",
            es: "Obtener el atajo",
        }),
        "settings.wallet.getAgain": t({
            en: "Get the shortcut again",
            es: "Obtener el atajo de nuevo",
        }),
        "settings.wallet.getDetail": t({
            en: "Installs the whole automation with one tap. Then turn it on.",
            es: "Instala la automatización completa con un toque. Luego actívala.",
        }),
        "settings.wallet.hide": t({
            en: "Hide",
            es: "Ocultar",
        }),
        "settings.wallet.installed": t({
            en: "Shortcut installed",
            es: "Atajo instalado",
        }),
        "settings.wallet.lastSection": t({
            en: "Last from Wallet",
            es: "Último desde Wallet",
        }),
        "settings.wallet.lead": t({
            en: "Every card tap lands on the Log, filed under the account it matches.",
            es: "Cada pago con tarjeta llega al registro, en la cuenta que coincida.",
        }),
        "settings.wallet.manualStep1": t({
            en: "Next, then New Blank Automation",
            es: "Siguiente, luego Nueva automatización en blanco",
        }),
        "settings.wallet.manualStep2": t({
            en: "Add Action, search Outlayr",
            es: "Agregar acción, busca Outlayr",
        }),
        "settings.wallet.manualStep2Detail": t({
            en: "Pick Log a Wallet Transaction",
            es: "Elige Log a Wallet Transaction",
        }),
        "settings.wallet.manualStep3": t({
            en: "Fill Amount, Merchant and Card",
            es: "Completa Amount, Merchant y Card",
        }),
        "settings.wallet.manualStep3Detail": t({
            en: "Tap each, choose Shortcut Input, then the matching field",
            es: "Toca cada uno, elige Entrada de atajo y luego el campo que corresponde",
        }),
        "settings.wallet.manualStep3Detail27": t({
            en: "Tap each, pick the Wallet variable above the keyboard, then the matching field",
            es: "Toca cada uno, elige la variable de Wallet sobre el teclado y luego el campo que corresponde",
        }),
        "settings.wallet.noAccounts": t({
            en: "No accounts yet",
            es: "Aún no hay cuentas",
        }),
        "settings.wallet.nothingLogged": t({
            en: "Nothing logged yet",
            es: "Nada registrado aún",
        }),
        "settings.wallet.nothingYet": t({
            en: "Nothing yet",
            es: "Nada aún",
        }),
        "settings.wallet.notifStep2": t({
            en: "Pick Notification, then the app",
            es: "Elige Notificación y luego la app",
        }),
        "settings.wallet.notifStep2Detail": t({
            en: "Your bank, or Wallet",
            es: "Tu banco, o Wallet",
        }),
        "settings.wallet.notifStep3Detail": t({
            en: "Pick Log from a Notification",
            es: "Elige Log from a Notification",
        }),
        "settings.wallet.notifStep4": t({
            en: "Fill Title, Subtitle and Body",
            es: "Completa Title, Subtitle y Body",
        }),
        "settings.wallet.notifStep4Detail": t({
            en: "Tap each, pick the Notification variable above the keyboard, then the matching field",
            es: "Toca cada uno, elige la variable de Notificación sobre el teclado y luego el campo que corresponde",
        }),
        "settings.wallet.notifStep5": t({
            en: "Type the account name in Account",
            es: "Escribe el nombre de la cuenta en Account",
        }),
        "settings.wallet.notifStep5Detail": t({
            en: "The one this app's card belongs to",
            es: "La cuenta a la que pertenece la tarjeta de esa app",
        }),
        "settings.wallet.notificationFooter": t({
            en: "Any app that sends a purchase push works, one automation per app. The amount and merchant are read from the text.",
            es: "Funciona con cualquier app que te mande una notificación de compra, con una automatización por app. El monto y el comercio se leen del texto.",
        }),
        "settings.wallet.notificationSection": t({
            en: "Or from a bank notification",
            es: "O desde una notificación del banco",
        }),
        "settings.wallet.open": t({
            en: "Open Shortcuts",
            es: "Abrir Atajos",
        }),
        "settings.wallet.ranAt": t({
            en: "The automation ran {when}",
            es: "La automatización se ejecutó {when}",
        }),
        "settings.wallet.setupSection": t({
            en: "Setup",
            es: "Configuración",
        }),
        "settings.wallet.shortcutName": t({
            en: "Outlayr - Apple Pay",
            es: "Outlayr - Apple Pay",
        }),
        "settings.wallet.show": t({
            en: "Show",
            es: "Ver",
        }),
        "settings.wallet.step1": t({
            en: "Automation, then +",
            es: "Automatización, luego +",
        }),
        "settings.wallet.step2": t({
            en: "Choose Wallet",
            es: "Elige Wallet",
        }),
        "settings.wallet.step2Detail": t({
            en: "Called Transaction before iOS 26",
            es: "Se llama Transacción antes de iOS 26",
        }),
        "settings.wallet.step3": t({
            en: "Pick your cards",
            es: "Elige tus tarjetas",
        }),
        "settings.wallet.step3Detail": t({
            en: "Run Immediately on, Notify When Run off",
            es: "Ejecutar de inmediato activado, Notificar al ejecutar desactivado",
        }),
        "settings.wallet.step5": t({
            en: "Done",
            es: "Listo",
        }),
        "settings.wallet.stepsSection": t({
            en: "Turn it on in Shortcuts",
            es: "Actívalo en Atajos",
        }),
        "settings.wallet.tryIt": t({
            en: "Tap a card to try it",
            es: "Paga con una tarjeta para probarlo",
        }),
        "settings.wallet.unattached": t({
            en: "Unattached",
            es: "Sin cuenta",
        }),
        "settings.wallet.v27Manual1": t({
            en: "New shortcut, then search Automation",
            es: "Nuevo atajo, luego busca Automatización",
        }),
        "settings.wallet.v27Manual2": t({
            en: "Pick Wallet",
            es: "Elige Wallet",
        }),
        "settings.wallet.v27Manual2Detail": t({
            en: "Any Card is fine. Automation is already on and Notify off.",
            es: "Cualquier tarjeta sirve. Automatización ya viene activada y Notificar desactivado.",
        }),
        "settings.wallet.v27Step1": t({
            en: "Library, then Automation",
            es: "Biblioteca, luego Automatización",
        }),
        "settings.wallet.v27Step1Detail": t({
            en: "A shared automation arrives turned off",
            es: "Una automatización compartida llega desactivada",
        }),
        "settings.wallet.v27Step2": t({
            en: "Turn on Outlayr - Apple Pay",
            es: "Activa Outlayr - Apple Pay",
        }),
    },
    key: "settings" as const,
} satisfies Dictionary;

export default settings;
