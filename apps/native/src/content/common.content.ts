import { type Dictionary, t } from "intlayer";

const common = {
	key: "common" as const,
	content: {
		"common.add": t({
			en: "Add",
			es: "Agregar",
		}),
		"common.all": t({
			en: "All",
			es: "Todo",
		}),
		"common.back": t({
			en: "Back",
			es: "Atrás",
		}),
		"common.cancel": t({
			en: "Cancel",
			es: "Cancelar",
		}),
		"common.close": t({
			en: "Close",
			es: "Cerrar",
		}),
		"common.continue": t({
			en: "Continue",
			es: "Continuar",
		}),
		"common.custom": t({
			en: "Custom",
			es: "Personalizado",
		}),
		"common.delete": t({
			en: "Delete",
			es: "Eliminar",
		}),
		"common.done": t({
			en: "Done",
			es: "Listo",
		}),
		"common.edit": t({
			en: "Edit",
			es: "Editar",
		}),
		"common.error": t({
			en: "Something went wrong",
			es: "Algo salió mal",
		}),
		"common.expense": t({
			en: "Expense",
			es: "Gasto",
		}),
		"common.hidden": t({
			en: "Hidden",
			es: "Oculto",
		}),
		"common.income": t({
			en: "Income",
			es: "Ingreso",
		}),
		"common.loading": t({
			en: "Loading",
			es: "Cargando",
		}),
		"common.never": t({
			en: "Never",
			es: "Nunca",
		}),
		"common.off": t({
			en: "Off",
			es: "Desactivado",
		}),
		"common.on": t({
			en: "On",
			es: "Activado",
		}),
		"common.remove": t({
			en: "Remove",
			es: "Quitar",
		}),
		"common.reset": t({
			en: "Reset",
			es: "Restablecer",
		}),
		"common.retry": t({
			en: "Try Again",
			es: "Reintentar",
		}),
		"common.save": t({
			en: "Save",
			es: "Guardar",
		}),
		"common.search": t({
			en: "Search",
			es: "Buscar",
		}),
		"common.shown": t({
			en: "Shown",
			es: "Visible",
		}),
		"common.skip": t({
			en: "Skip",
			es: "Omitir",
		}),
		"common.system": t({
			en: "System",
			es: "Sistema",
		}),
		"common.today": t({
			en: "Today",
			es: "Hoy",
		}),
		"common.tomorrow": t({
			en: "Tomorrow",
			es: "Mañana",
		}),
		"common.yesterday": t({
			en: "Yesterday",
			es: "Ayer",
		}),
		"error.boundary.title": t({
			en: "Something Went Wrong",
			es: "Algo salió mal",
		}),
		"error.boundary.body": t({
			en: "Outlayr hit an unexpected error. Your data is untouched — try again.",
			es: "Outlayr encontró un error inesperado. Tus datos están intactos — inténtalo de nuevo.",
		}),
		"nav.tab.log": t({
			en: "Log",
			es: "Registro",
		}),
		"nav.tab.insights": t({
			en: "Insights",
			es: "Estadísticas",
		}),
		"nav.tab.budgets": t({
			en: "Budgets",
			es: "Presupuestos",
		}),
		"nav.tab.settings": t({
			en: "Settings",
			es: "Configuración",
		}),
		"nav.search": t({
			en: "Search",
			es: "Buscar",
		}),
		"nav.newTransaction": t({
			en: "New Transaction",
			es: "Nueva transacción",
		}),
		"nav.editTransaction": t({
			en: "Edit Transaction",
			es: "Editar transacción",
		}),
		"nav.categories": t({
			en: "Categories",
			es: "Categorías",
		}),
		"nav.newCategory": t({
			en: "New Category",
			es: "Nueva categoría",
		}),
		"nav.editCategory": t({
			en: "Edit Category",
			es: "Editar categoría",
		}),
		"nav.newSubcategory": t({
			en: "New Subcategory",
			es: "Nueva subcategoría",
		}),
		"nav.subcategory": t({
			en: "Subcategory",
			es: "Subcategoría",
		}),
		"nav.settings.about": t({
			en: "About & Credits",
			es: "Acerca de & Créditos",
		}),
		"nav.settings.account": t({
			en: "Account",
			es: "Cuenta",
		}),
		"nav.settings.appIcon": t({
			en: "App Icon",
			es: "Ícono de la app",
		}),
		"nav.settings.currency": t({
			en: "Currency",
			es: "Moneda",
		}),
		"nav.settings.erase": t({
			en: "Erase Data",
			es: "Borrar datos",
		}),
		"nav.settings.export": t({
			en: "Export Data",
			es: "Exportar datos",
		}),
		"nav.settings.featureLab": t({
			en: "Feature Lab",
			es: "Laboratorio de funciones",
		}),
		"nav.settings.haptics": t({
			en: "Haptics",
			es: "Hápticos",
		}),
		"nav.settings.language": t({
			en: "Language",
			es: "Idioma",
		}),
		"nav.settings.notifications": t({
			en: "Notifications",
			es: "Notificaciones",
		}),
		"nav.settings.numberEntry": t({
			en: "Number Entry",
			es: "Ingreso de números",
		}),
		"nav.settings.restore": t({
			en: "Restore Data",
			es: "Restaurar datos",
		}),
		"nav.settings.theme": t({
			en: "Theme",
			es: "Tema",
		}),
		"nav.settings.time": t({
			en: "Time Frames",
			es: "Períodos de tiempo",
		}),
		"nav.settings.upcoming": t({
			en: "Upcoming Logs",
			es: "Próximos registros",
		}),
		"notFound.navTitle": t({
			en: "Not Found",
			es: "No encontrado",
		}),
		"notFound.title": t({
			en: "Nothing Here",
			es: "Aquí no hay nada",
		}),
		"notFound.body": t({
			en: "That link does not point anywhere in Outlayr. Your ledger is where you left it.",
			es: "Ese enlace no lleva a ninguna parte en Outlayr. Tu registro sigue donde lo dejaste.",
		}),
		"notFound.action": t({
			en: "Back to the Log",
			es: "Volver al registro",
		}),
		"spotlight.entry": t({
			en: "Entry",
			es: "Registro",
		}),
		"spotlight.budget.title": t({
			en: "{name} budget",
			es: "Presupuesto de {name}",
		}),
		// A per-category budget whose category is gone has nothing left to name it.
		// Deliberately not the overall budget's label: this row deep-links to one
		// category's cap, and calling it "Overall Budget" would claim otherwise.
		"spotlight.budget.fallback": t({
			en: "Budget",
			es: "Presupuesto",
		}),
		"spotlight.budget.limit": t({
			en: "Limit {amount}",
			es: "Límite {amount}",
		}),
		// Lowercase on purpose: a Spotlight keyword is a term someone types, not a
		// label the app renders.
		"spotlight.budget.keyword": t({
			en: "budget",
			es: "presupuesto",
		}),
	},
} satisfies Dictionary;

export default common;
