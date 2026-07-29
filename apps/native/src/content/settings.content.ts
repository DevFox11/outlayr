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
		"settings.currency.search": t({
			en: "Search currencies",
			es: "Buscar monedas",
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
		"settings.export.footer": t({
			en: "Deleted transactions are left out. Everything else on this device is written, newest first.",
			es: "Las transacciones eliminadas se omiten. Todo lo demás en este dispositivo se escribe, de lo más reciente a lo más antiguo.",
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
		"settings.export.columns": t({
			en: "Columns",
			es: "Columnas",
		}),
		"settings.export.columnsNote": t({
			en: "Dates are ISO 8601 instants and amounts are plain decimals with no grouping, so the file reads back into Outlayr — or into a spreadsheet — as the same figures.",
			es: "Las fechas son instantes ISO 8601 y los montos son decimales simples sin separadores de miles, así que el archivo se vuelve a leer en Outlayr — o en una hoja de cálculo — con las mismas cifras.",
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
