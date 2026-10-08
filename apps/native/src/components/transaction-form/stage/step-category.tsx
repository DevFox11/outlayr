import { ScrollView } from "react-native";

import { CategoryIconTile } from "@/components/category-icon-tile";
import type { Category, CategoryWithChildren } from "@/data/categories-core";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { StageOptionRow } from "./stage-options";
import type { StageOptionItem } from "./stage-options";

/**
 * Four rows of pills — 38pt each with 8pt between them. Past that, at standard
 * text sizes, the options scroll inside the step rather than growing the stage,
 * which is docked to the bottom of the form and would otherwise push the
 * sentence off the screen.
 */
const MAX_LIST_HEIGHT = 176;

/** Reads inside a 38pt pill without crowding the label. */
const TILE = 22;

/** The crumb the picker sheet already draws between a holder and its child. */
const CRUMB = " › ";

/** No category id can collide: they are uuids. */
const CREATE_OPTION = "__create__";

interface FlatCategory {
    category: Category;
    label: string;
}

/**
 * Tree order, each holder followed by its own children. Categories nest one
 * level — `useCategoriesByNamespace` returns top-level rows with their children
 * nested, and a child holds none of its own — and a row of pills has nowhere to
 * put the sheet's disclosure, so a child states its holder inline instead. Two
 * leaves both called "Coffee" would otherwise be the same pill twice.
 */
function flattenCategories(categories: readonly CategoryWithChildren[]): FlatCategory[] {
    const flat: FlatCategory[] = [];
    for (const parent of categories) {
        flat.push({ category: parent, label: parent.name ?? "" });
        for (const child of parent.children) {
            flat.push({ category: child, label: `${parent.name ?? ""}${CRUMB}${child.name ?? ""}` });
        }
    }
    return flat;
}

interface StepCategoryProps {
    /** Top-level rows with their children nested, as `useCategoriesByNamespace` hands them over. */
    categories: readonly CategoryWithChildren[];
    /** Omitted by a host that cannot mint a category, which also drops the option. */
    onCreate?: () => void;
    onSelect: (category: Category) => void;
    selectedId: string | null;
}

/** The stage's category step: every category as an option, holders before their children. */
export function StepCategory({ categories, onCreate, onSelect, selectedId }: StepCategoryProps) {
    const t = useTranslation();
    const colors = useColors();
    const largeText = useAccessibilityTextSize();
    const flat = flattenCategories(categories);

    const options: StageOptionItem<string>[] = flat.map(({ category, label }) => ({
        id: category.id,
        label,
        leading: (
            <CategoryIconTile
                // An income category takes the income token rather than its stored
                // colour, exactly as the picker sheet tints it.
                color={category.income ? colors.income : (category.color ?? colors.muted)}
                emoji={category.emoji}
                icon={category.icon}
                radius={6}
                size={TILE}
                type="solid"
            />
        ),
    }));
    if (onCreate) {
        options.push({ id: CREATE_OPTION, label: t("categories.addCategory") });
    }

    const pick = (id: string) => {
        if (id === CREATE_OPTION) {
            onCreate?.();
            return;
        }
        const picked = flat.find((entry) => entry.category.id === id);
        if (picked) {
            onSelect(picked.category);
        }
    };

    return (
        <ScrollView
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!largeText}
            showsVerticalScrollIndicator={false}
            style={largeText ? undefined : { maxHeight: MAX_LIST_HEIGHT }}
            testID="stage-categories"
        >
            <StageOptionRow onSelect={pick} options={options} selectedId={selectedId} />
        </ScrollView>
    );
}
