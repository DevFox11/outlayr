import { and, eq, isNull } from "drizzle-orm";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import CategoryEditor from "@/components/category-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDatabase } from "@/contexts/local-data-context";
import { categoriesRepo, getCategoryById } from "@/data/categories-core";
import type { Category } from "@/data/categories-core";
import { categories } from "@/db/schema";
import type { TranslatableKey } from "@/i18n/catalog";
import { useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";

function categoryKindKey(edited: Category | null): TranslatableKey {
    if (edited == null) {
        return "categories.kind.category";
    }
    if (edited.parentId != null) {
        return "categories.kind.subcategory";
    }
    return edited.income ? "categories.kind.income" : "categories.kind.expense";
}

export function CategoryEditScreen({ id }: { id: string }) {
    const router = useRouter();
    const db = useDatabase();
    const t = useTranslation();
    const colors = useColors();
    const haptics = useHaptics();

    // Read once on mount, like the editor does — a rename must not retitle the
    // sheet mid-edit.
    const [edited] = useState(() => (id ? getCategoryById(db, id) : null));
    const title = t(categoryKindKey(edited));

    const confirmDelete = async () => {
        if (!id) {
            return;
        }
        const category = await getCategoryById(db, id);
        if (category == null) {
            return;
        }
        const children = await db
            .select({ id: categories.id })
            .from(categories)
            .where(and(eq(categories.parentId, id), isNull(categories.deletedAt)));
        const message = t(children.length > 0 ? "categories.delete.messageWithChildren" : "categories.delete.message", {
            name: category.name,
        });
        Alert.alert(t("categories.delete.title", { name: category.name }), message, [
            { style: "cancel", text: t("common.cancel") },
            {
                onPress: async () => {
                    haptics("warning");
                    await categoriesRepo.remove(db, id);
                    router.back();
                },
                style: "destructive",
                text: t("common.delete"),
            },
        ]);
    };

    return (
        <>
            <Stack.Screen.Title>{title}</Stack.Screen.Title>

            <Stack.Toolbar placement="left">
                <Stack.Toolbar.Button
                    {...toolbarIcon("close")}
                    accessibilityLabel={t("common.close")}
                    onPress={() => router.back()}
                />
            </Stack.Toolbar>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("delete")}
                    accessibilityLabel={t("common.delete")}
                    onPress={confirmDelete}
                    tintColor={colors.danger}
                />
            </Stack.Toolbar>

            <CategoryEditor id={id} mode="edit" />
        </>
    );
}
