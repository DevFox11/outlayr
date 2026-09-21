import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const categories = {
    content: {
        "categories.a11y.hideSuggestions": t({
            en: "Hide suggestions",
            es: "Ocultar sugerencias",
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
        "categories.addCategory": t({
            en: "Add Category",
            es: "Agregar categoría",
        }),
        "categories.addSubcategory": t({
            en: "Add Subcategory",
            es: "Agregar subcategoría",
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
        "categories.empty.expense": t({
            en: "No expense categories found, click the ‘New’ button to add some",
            es: "Aún no hay categorías de gasto. Toca + para agregar una.",
        }),
        "categories.empty.income": t({
            en: "No income categories found, click the ‘New’ button to add some",
            es: "Aún no hay categorías de ingreso. Toca + para agregar una.",
        }),
        "categories.error.deleteTitle": t({
            en: "Couldn't Delete Category",
            es: "No se pudo eliminar la categoría",
        }),
        "categories.error.duplicate": t({
            en: "A category with this symbol and name already exists.",
            es: "Ya existe una categoría con este símbolo y nombre.",
        }),
        "categories.error.duplicateEmoji": t({
            en: "Another category already uses this emoji.",
            es: "Otra categoría ya usa este emoji.",
        }),
        "categories.error.duplicateIcon": t({
            en: "Another category already uses this icon.",
            es: "Otra categoría ya usa este ícono.",
        }),
        "categories.error.duplicateName": t({
            en: "Another category already uses this name.",
            es: "Otra categoría ya usa este nombre.",
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
            es: "Elige un ícono o emoji para la categoría.",
        }),
        "categories.error.missingName": t({
            en: "Please enter a name for this category.",
            es: "Ingresa un nombre para esta categoría.",
        }),
        "categories.field.name": t({
            en: "Name",
            es: "Nombre",
        }),
        "categories.field.type": t({
            en: "Type",
            es: "Tipo",
        }),
        "categories.incomeColorNote": t({
            en: "Income categories use the income color.",
            es: "Las categorías de ingreso usan el color de ingreso.",
        }),
        "categories.inherits": t({
            en: "Inherits {parent}'s color.",
            es: "Usa el color de {parent}.",
        }),
        "categories.kind.category": t({
            en: "Category",
            es: "Categoría",
        }),
        "categories.kind.expense": t({
            en: "Expense Category",
            es: "Categoría de gasto",
        }),
        "categories.kind.income": t({
            en: "Income Category",
            es: "Categoría de ingreso",
        }),
        "categories.kind.subcategory": t({
            en: "Subcategory",
            es: "Subcategoría",
        }),
        "categories.namePlaceholder.expense": t({
            en: "Groceries, Rent…",
            es: "Súper, Renta…",
        }),
        "categories.namePlaceholder.income": t({
            en: "Salary, Freelance…",
            es: "Sueldo, Freelance…",
        }),
        "categories.namePlaceholder.subcategory": t({
            en: "Coffee, Snacks…",
            es: "Café, Botanas…",
        }),
        "categories.reorderTitle": t({
            en: "Reorder Categories",
            es: "Reordenar categorías",
        }),
        "categories.saveCategory": t({
            en: "Save Category",
            es: "Guardar categoría",
        }),
        "categories.saveSubcategory": t({
            en: "Save Subcategory",
            es: "Guardar subcategoría",
        }),
        "categories.suggested.eyebrow": t({
            en: "Suggested · {count}",
            es: "Sugeridas · {count}",
        }),
        "categories.title": t({
            en: "Categories",
            es: "Categorías",
        }),
        "categories.toast.added": t({
            en: "Category added",
            es: "Categoría agregada",
        }),
        "categories.undo.body": t({
            en: "Its transactions go with it.",
            es: "Sus transacciones se borran con ella.",
        }),
        "categories.undo.bodyWithChildren": t({
            en: "Its transactions go with it; its subcategories move to the top level.",
            es: "Sus transacciones se borran con ella; sus subcategorías pasan al nivel superior.",
        }),
        "categories.undo.deleted": t({
            en: "Category deleted",
            es: "Categoría eliminada",
        }),
    },
    key: "categories" as const,
} satisfies Dictionary;

export default categories;
