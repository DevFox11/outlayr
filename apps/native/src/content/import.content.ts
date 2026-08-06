import { type Dictionary, t } from "intlayer";

const importSheet = {
	key: "import" as const,
	content: {
		"import.titleSource": t({
			en: "Import",
			es: "Importar",
		}),
		"import.titleFile": t({
			en: "Choose a file",
			es: "Elige un archivo",
		}),
		"import.sourceLede": t({
			en: "Bring transactions in from a file. Everything is read on your device.",
			es: "Trae transacciones desde un archivo. Todo se lee en tu dispositivo.",
		}),
		"import.sourceEyebrow": t({
			en: "Bring data in",
			es: "Trae tus datos",
		}),
		"import.sourceCount": t({
			en: "{count} of {total}",
			es: "{count} de {total}",
		}),
		"import.sourceComingSoon": t({
			en: "Coming soon",
			es: "Próximamente",
		}),
		"import.fileEmptyCaption": t({
			en: "No file chosen",
			es: "Ningún archivo elegido",
		}),
		"import.chooseCsv": t({
			en: "Choose CSV",
			es: "Elegir CSV",
		}),
		"import.fileOnDeviceNote": t({
			en: "Large files are read on your device only.",
			es: "Los archivos grandes se leen solo en tu dispositivo.",
		}),
		"import.fileRowsLabel": t({
			en: "Rows",
			es: "Filas",
		}),
		"import.fileColumnsLabel": t({
			en: "Columns",
			es: "Columnas",
		}),
		"import.fileReadOnDevice": t({
			en: "Read on this device",
			es: "Leído en este dispositivo",
		}),
		"import.fileDatesLabel": t({
			en: "Dates",
			es: "Fechas",
		}),
		"import.fileNoCategoryColumn": t({
			en: "No category column — we'll read the Description column instead.",
			es: "No hay columna de categoría — leeremos la columna Descripción en su lugar.",
		}),
		"import.chooseDifferentFile": t({
			en: "Choose a different file",
			es: "Elegir otro archivo",
		}),
		"import.errorIoTitle": t({
			en: "We couldn't read that file",
			es: "No pudimos leer ese archivo",
		}),
		"import.errorEmptyTitle": t({
			en: "This doesn't look like a CSV file",
			es: "Esto no parece un archivo CSV",
		}),
		"import.errorEmptyBody": t({
			en: "We couldn't find any comma-separated data in this file.",
			es: "No encontramos datos separados por comas en este archivo.",
		}),
		"import.errorNoDataTitle": t({
			en: "No transactions found in this file",
			es: "No se encontraron transacciones en este archivo",
		}),
		"import.errorNoDataBody": t({
			en: "This file has a header row but no data below it.",
			es: "Este archivo tiene una fila de encabezado pero sin datos debajo.",
		}),
		"import.errorTooFewColumnsTitle": t({
			en: "This file has fewer than 3 columns",
			es: "Este archivo tiene menos de 3 columnas",
		}),
		"import.errorTooFewColumnsBody": t({
			en: "Outlayr needs at least a date, an amount, and a category or description column.",
			es: "Outlayr necesita al menos una fecha, un monto y una columna de categoría o descripción.",
		}),
		"import.errorTooLargeTitle": t({
			en: "This file is too large to open",
			es: "Este archivo es demasiado grande para abrir",
		}),
		"import.errorTooLargeBody": t({
			en: "Try exporting a smaller date range from your bank.",
			es: "Intenta exportar un rango de fechas más pequeño desde tu banco.",
		}),
		"import.mappingGapTitle": t({
			en: "We couldn't find the right columns",
			es: "No pudimos encontrar las columnas correctas",
		}),
		"import.mappingGapNoLabel": t({
			en: "No description or category column",
			es: "No hay columna de descripción o categoría",
		}),
		"import.mappingGapNoDate": t({
			en: "No date column",
			es: "No hay columna de fecha",
		}),
		"import.mappingGapNoAmount": t({
			en: "No amount column",
			es: "No hay columna de monto",
		}),
		"import.mappingGapGuidance": t({
			en: "Add a header row that names the missing column, or choose a file that already has one.",
			es: "Agrega una fila de encabezado que nombre la columna faltante, o elige un archivo que ya la tenga.",
		}),
		"import.titleResolve": t({
			en: "Preparing",
			es: "Preparando",
		}),
		"import.resolveEyebrowRows": t({
			en: "{count} rows",
			es: "{count} filas",
		}),
		"import.resolveFootnote": t({
			en: "Only unmatched merchant names and your category names are sent — never your amounts, dates, or the file itself.",
			es: "Solo se envían los nombres de comercios sin coincidencia y tus categorías — nunca tus montos, fechas ni el archivo.",
		}),
		"import.titleReview": t({
			en: "Review",
			es: "Revisar",
		}),
		"import.resumeNotice": t({
			en: "Picking up where you left off",
			es: "Continuamos donde lo dejaste",
		}),
		"import.resumeBody": t({
			en: "Your file and progress were kept.",
			es: "Tu archivo y tu progreso quedaron guardados.",
		}),
		"import.startOver": t({
			en: "Start over",
			es: "Empezar de nuevo",
		}),
		"import.resolveConsentHeading": t({
			en: "What leaves your device",
			es: "Qué sale de tu dispositivo",
		}),
		"import.resolveConsentBulletLabels": t({
			en: "Merchant names we couldn't match on device — up to 200.",
			es: "Nombres de comercios que no pudimos identificar en el dispositivo — hasta 200.",
		}),
		"import.resolveConsentBulletCategories": t({
			en: "Your own category names, so suggestions land in categories you already have.",
			es: "Tus propias categorías, para que las sugerencias usen categorías que ya tienes.",
		}),
		"import.resolveConsentBulletNever": t({
			en: "Never: your amounts, your dates, or the file itself.",
			es: "Nunca: tus montos, tus fechas, ni el archivo en sí.",
		}),
		"import.resolveCategoriseCta": t({
			en: "Categorise {count} merchants",
			es: "Categorizar {count} comercios",
		}),
		"import.resolveReviewCta": t({
			en: "Review {count} transactions",
			es: "Revisar {count} transacciones",
		}),
		"import.resolveRunningReadFile": t({
			en: "Read the file",
			es: "Leímos el archivo",
		}),
		"import.resolveRunningMatched": t({
			en: "Matched on device",
			es: "Coincidencias en el dispositivo",
		}),
		"import.resolveRunningAsked": t({
			en: "Asked the model",
			es: "Consultamos al modelo",
		}),
		"import.unavailableTitle": t({
			en: "Suggestions are unavailable",
			es: "Las sugerencias no están disponibles",
		}),
		"import.unavailableOffline": t({
			en: "You're offline.",
			es: "Estás sin conexión.",
		}),
		"import.unavailableTimeout": t({
			en: "It took too long.",
			es: "Tardó demasiado.",
		}),
		"import.unavailableRateLimited": t({
			en: "Too many imports this hour.",
			es: "Demasiadas importaciones esta hora.",
		}),
		"import.unavailableProviderError": t({
			en: "The service didn't answer.",
			es: "El servicio no respondió.",
		}),
		"import.unavailableUnauthenticated": t({
			en: "Sign in to get AI suggestions.",
			es: "Inicia sesión para obtener sugerencias de IA.",
		}),
		"import.unavailableNotConfigured": t({
			en: "Not configured yet.",
			es: "Aún no está configurado.",
		}),
		"import.unavailableInvalidResponse": t({
			en: "We didn't understand the answer, so we ignored all of it.",
			es: "No entendimos la respuesta, así que la ignoramos por completo.",
		}),
		"import.unavailableOverCap": t({
			en: "This file is too large to send, so it was read on your device only.",
			es: "Este archivo es demasiado grande para enviar, así que se leyó solo en tu dispositivo.",
		}),
		"import.tryAgain": t({
			en: "Try again",
			es: "Intentar de nuevo",
		}),
		"import.declinedBody": t({
			en: "AI suggestions are off in Settings → Feature Lab.",
			es: "Las sugerencias de IA están desactivadas en Ajustes → Laboratorio de funciones.",
		}),
		"import.openFeatureLab": t({
			en: "Open Feature Lab",
			es: "Abrir Laboratorio de funciones",
		}),
		"import.reviewCommitCta": t({
			en: "Import {count} transactions",
			es: "Importar {count} transacciones",
		}),
		"import.reviewCommitConfirmCta": t({
			en: "Import {count} transactions?",
			es: "¿Importar {count} transacciones?",
		}),
		"import.titleDone": t({
			en: "Imported",
			es: "Importado",
		}),
		"import.doneStamp": t({
			en: "Imported · {count} rows",
			es: "Importado · {count} filas",
		}),
		"import.doneSubline": t({
			en: "{count} duplicates skipped · {month} is on the Log",
			es: "{count} duplicados omitidos · {month} ya está en el registro",
		}),
		"import.doneSublineNoDuplicates": t({
			en: "{month} is on the Log",
			es: "{month} ya está en el registro",
		}),
		"import.doneAddedLabel": t({
			en: "Added",
			es: "Agregadas",
		}),
		"import.reviewCommitFailedTitle": t({
			en: "Nothing was imported",
			es: "No se importó nada",
		}),
		"import.reviewCommitFailedBody": t({
			en: "The write failed, so your ledger is unchanged. Your selections are still here.",
			es: "La escritura falló, así que tu balance no cambió. Tus selecciones siguen aquí.",
		}),
		"import.reviewDuplicateCaption": t({
			en: "Looks already imported.",
			es: "Parece que ya se importó.",
		}),
		"import.reviewToImportLabel": t({
			en: "To import",
			es: "Para importar",
		}),
		"import.reviewToImportValue": t({
			en: "{count} of {total}",
			es: "{count} de {total}",
		}),
		"import.reviewSkippedShow": t({
			en: "{count} rows skipped · Show",
			es: "{count} filas omitidas · Mostrar",
		}),
		"import.reviewSkippedHide": t({
			en: "{count} rows skipped · Hide",
			es: "{count} filas omitidas · Ocultar",
		}),
		"import.reviewEmptyTitle": t({
			en: "Nothing to import",
			es: "Nada para importar",
		}),
		"import.skipReasonCategory": t({
			en: "No matching category",
			es: "Sin categoría coincidente",
		}),
		"import.skipReasonDate": t({
			en: "Unreadable date",
			es: "Fecha ilegible",
		}),
		"import.skipReasonAmount": t({
			en: "Unreadable amount",
			es: "Monto ilegible",
		}),
	},
} satisfies Dictionary;

export default importSheet;
