import { type Dictionary, t } from "intlayer";

const categories = {
	key: "categories" as const,
	content: {
		"categories.title": t({
			en: "Categories",
			es: "Categorías",
		}),
		"categories.reorderTitle": t({
			en: "Reorder Categories",
			es: "Reordenar categorías",
		}),
		"categories.kind.category": t({
			en: "Category",
			es: "Categoría",
		}),
		"categories.kind.subcategory": t({
			en: "Subcategory",
			es: "Subcategoría",
		}),
		"categories.kind.income": t({
			en: "Income Category",
			es: "Categoría de ingreso",
		}),
		"categories.kind.expense": t({
			en: "Expense Category",
			es: "Categoría de gasto",
		}),
		"categories.a11y.new": t({
			en: "New category",
			es: "Nueva categoría",
		}),
		"categories.a11y.reorder": t({
			en: "Reorder categories",
			es: "Reordenar categorías",
		}),
		"categories.a11y.showSuggestions": t({
			en: "Show suggestions",
			es: "Mostrar sugerencias",
		}),
		"categories.a11y.hideSuggestions": t({
			en: "Hide suggestions",
			es: "Ocultar sugerencias",
		}),
		"categories.census.categories_one": t({
			en: "{count} category",
			es: "{count} categoría",
		}),
		"categories.census.categories_other": t({
			en: "{count} categories",
			es: "{count} categorías",
		}),
		"categories.census.subcategories_one": t({
			en: "{count} subcategory",
			es: "{count} subcategoría",
		}),
		"categories.census.subcategories_other": t({
			en: "{count} subcategories",
			es: "{count} subcategorías",
		}),
		"categories.suggested.eyebrow": t({
			en: "Suggested · {count}",
			es: "Sugeridas · {count}",
		}),
		"categories.empty.expense": t({
			en: "No expense categories found, click the ‘New’ button to add some",
			es: "No se encontraron categorías de gastos; toca el botón ‘Nuevo’ para agregar algunas",
		}),
		"categories.empty.income": t({
			en: "No income categories found, click the ‘New’ button to add some",
			es: "No se encontraron categorías de ingresos; toca el botón ‘Nuevo’ para agregar algunas",
		}),
		"categories.delete.title": t({
			en: "Delete ‘{name}’?",
			es: "¿Eliminar ‘{name}’?",
		}),
		"categories.delete.message": t({
			en: "This can't be undone. All {name} transactions will be deleted too.",
			es: "Esto no se puede deshacer. Se eliminarán también todas las transacciones de {name}.",
		}),
		"categories.delete.messageWithChildren": t({
			en: "This can't be undone. {name} transactions will be deleted; its subcategories will be moved to the top level.",
			es: "Esto no se puede deshacer. Las transacciones de {name} se eliminarán; sus subcategorías se moverán al nivel superior.",
		}),
		"categories.addCategory": t({
			en: "Add Category",
			es: "Agregar categoría",
		}),
		"categories.addSubcategory": t({
			en: "Add Subcategory",
			es: "Agregar subcategoría",
		}),
		"categories.saveCategory": t({
			en: "Save Category",
			es: "Guardar categoría",
		}),
		"categories.saveSubcategory": t({
			en: "Save Subcategory",
			es: "Guardar subcategoría",
		}),
		"categories.field.name": t({
			en: "Name",
			es: "Nombre",
		}),
		"categories.field.type": t({
			en: "Type",
			es: "Tipo",
		}),
		"categories.namePlaceholder.expense": t({
			en: "Groceries, Rent…",
			es: "Víveres, Renta…",
		}),
		"categories.namePlaceholder.income": t({
			en: "Salary, Freelance…",
			es: "Salario, Freelance…",
		}),
		"categories.namePlaceholder.subcategory": t({
			en: "Coffee, Snacks…",
			es: "Café, Botanas…",
		}),
		"categories.inherits": t({
			en: "Inherits {parent}'s color.",
			es: "Usa el color de {parent}.",
		}),
		"categories.incomeColorNote": t({
			en: "Income categories use the income color.",
			es: "Las categorías de ingreso usan el color de ingreso.",
		}),
		"categories.toast.added": t({
			en: "Category added",
			es: "Categoría agregada",
		}),
		"categories.ok": t({
			en: "OK",
			es: "OK",
		}),
		"categories.error.addTitle": t({
			en: "Couldn't Add Category",
			es: "No se pudo agregar la categoría",
		}),
		"categories.error.saveTitle": t({
			en: "Couldn't Save Category",
			es: "No se pudo guardar la categoría",
		}),
		"categories.error.generic": t({
			en: "Please try again.",
			es: "Inténtalo de nuevo.",
		}),
		"categories.error.incomplete": t({
			en: "Please choose an icon or emoji, and a name.",
			es: "Elige un ícono o emoji, y un nombre.",
		}),
		"categories.error.missingIcon": t({
			en: "Please choose an icon or emoji for the category.",
			es: "Por favor elige un ícono o emoji para la categoría.",
		}),
		"categories.error.missingName": t({
			en: "Please enter a name for this category.",
			es: "Ingresa un nombre para esta categoría.",
		}),
		"categories.error.duplicate": t({
			en: "A category with this symbol and name already exists.",
			es: "Ya existe una categoría con este símbolo y nombre.",
		}),
		"categories.error.duplicateIcon": t({
			en: "Another category already uses this icon.",
			es: "Otra categoría ya usa este ícono.",
		}),
		"categories.error.duplicateEmoji": t({
			en: "Another category already uses this emoji.",
			es: "Otra categoría ya usa este emoji.",
		}),
		"categories.error.duplicateName": t({
			en: "Another category already uses this name.",
			es: "Otra categoría ya usa este nombre.",
		}),
	},
} satisfies Dictionary;

export default categories;
