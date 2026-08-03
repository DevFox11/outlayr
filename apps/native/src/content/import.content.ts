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
		"import.sourceComingSoon": t({
			en: "Coming soon",
			es: "Próximamente",
		}),
		"import.mapManually": t({
			en: "Map columns manually",
			es: "Asignar columnas manualmente",
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
		"import.fileFormatNote": t({
			en: "Dates look like {format} · decimal {decimal}",
			es: "Las fechas se ven como {format} · decimal {decimal}",
		}),
		"import.decimalComma": t({
			en: "comma",
			es: "coma",
		}),
		"import.decimalPoint": t({
			en: "point",
			es: "punto",
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
	},
} satisfies Dictionary;

export default importSheet;
