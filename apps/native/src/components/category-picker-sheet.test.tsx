import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createRef } from "react";

import { seedCategories, seededCategoryId } from "@/data/categories-core";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { CategoryPickerSheet } from "./category-picker-sheet";
import type { CategoryPickerSheetRef } from "./category-picker-sheet";

jest.mock<Partial<typeof import("@react-native-async-storage/async-storage")>>(
    "@react-native-async-storage/async-storage",
    () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock<Partial<typeof import("expo-sqlite")>>("expo-sqlite", () => ({
    addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
            accent: "#010101",
            accentForeground: "#ffffff",
            background: "#ffffff",
            border: "#d2d6db",
            danger: "#da0f01",
            expense: "#010101",
            foreground: "#010101",
            future: "#6d6d6d",
            groupedBackground: "#f2f2f7",
            income: "#027d51",
            muted: "#6d6d6d",
            overBudget: "#da0f01",
            railTrack: "rgba(0,0,0,.06)",
            separator: "#d2d6db",
            subtle: "#6c6c78",
            surface: "#f6f6f6",
            surfaceSecondary: "#f0f0f0",
            tint: "#0069de",
            warning: "#d8a13a",
        }),
}));
jest.mock("@/i18n/context", () => ({
    useTranslation:
        () =>
        (key: string, params?: Record<string, string>): string =>
            params == null ? key : `${key}:${Object.values(params).join(",")}`,
}));

const GROCERIES = seededCategoryId("Groceries", false);

async function seededDb(): Promise<Database> {
    const db = migratedDatabase();
    await seedCategories(db);
    return db;
}

function addChild(db: Database, id: string, name: string, parentId: string): void {
    db.insert(categories)
        .values({
            color: "#34C759",
            icon: "ShoppingCart01",
            id,
            income: false,
            name,
            parentId,
            sortOrder: 0,
            updatedAt: new Date(0),
        })
        .run();
}

function addTransaction(db: Database, categoryId: string, at: number): void {
    const date = new Date(at);
    db.insert(transactions)
        .values({
            amount: 5,
            categoryId,
            date,
            day: date,
            id: `tx-${at}`,
            income: false,
            month: date,
            note: "",
            updatedAt: date,
        })
        .run();
}

interface SheetOptions {
    db: Database;
    excludeIds?: readonly string[];
    onCreate?: (name: string) => void;
    onSelect?: (category: { id: string; name: string | null }) => void;
    selectedId?: string | null;
}

async function mount(options: SheetOptions) {
    const ref = createRef<CategoryPickerSheetRef>();
    const view = await render(
        <CategoryPickerSheet
            db={options.db}
            excludeIds={options.excludeIds}
            income={false}
            onCreate={options.onCreate}
            onSelect={options.onSelect ?? (() => {})}
            ref={ref}
            selectedId={options.selectedId ?? null}
        />
    );
    await act(async () => {
        ref.current?.present();
    });
    return { ...view, ref };
}

async function type(query: string): Promise<void> {
    await act(async () => {
        fireEvent.changeText(screen.getByTestId("category-search"), query);
    });
}

/**
 * Not `fireEvent.press`: RN renders `Pressable`'s host view with `onClick` and
 * responder handlers but no `onPress`, so RNTL 14.0.1 finds no handler and the
 * press silently does nothing instead of failing.
 */
function press(testID: string): void {
    fireEvent(screen.getByTestId(testID), "click");
}

describe("categoryPickerSheet", () => {
    it("expands the parent of a selected subcategory so its checkmark is reachable", async () => {
        const db = await seededDb();
        addChild(db, "organic", "Organic", GROCERIES);
        await mount({ db, selectedId: "organic" });

        expect(screen.getByText("Organic")).toBeTruthy();
    });

    it("leaves parents collapsed when the selection is top-level", async () => {
        const db = await seededDb();
        addChild(db, "organic", "Organic", GROCERIES);
        await mount({ db, selectedId: GROCERIES });

        expect(screen.queryByText("Organic")).toBeNull();
    });

    it("drops an excluded category from the list", async () => {
        const db = await seededDb();
        await mount({ db, excludeIds: [GROCERIES] });

        expect(screen.queryByText("Groceries")).toBeNull();
    });

    it("keeps an excluded parent as a container, so its children stay reachable", async () => {
        // A budget on a parent does not rule one out on a subcategory: the schema
        // is unique per exact id, so removing the whole branch took a real choice
        // away.
        const db = await seededDb();
        addChild(db, "organic", "Organic", GROCERIES);
        await mount({ db, excludeIds: [GROCERIES] });

        expect(screen.getByText("Groceries")).toBeTruthy();
        await act(async () => {
            fireEvent(screen.getByLabelText(/a11yExpand/), "click");
        });
        expect(screen.getByText("Organic")).toBeTruthy();
    });

    it("does not offer an excluded category from the search results", async () => {
        const db = await seededDb();
        await mount({ db, excludeIds: [GROCERIES] });
        await type("groc");

        expect(screen.queryByText("Groceries")).toBeNull();
    });

    // The clear button is an icon with no text child, so without a label VoiceOver
    // reaches an unnamed control mid-search and cannot say what it does.
    it("names its clear button, which is otherwise a bare glyph", async () => {
        await mount({ db: await seededDb() });
        await type("rent");

        expect(screen.getByLabelText("common.clearSearch")).toBeTruthy();
    });

    it("filters the list down to the categories that match", async () => {
        await mount({ db: await seededDb() });
        await type("rent");

        expect(screen.getByText("Rent")).toBeTruthy();
        expect(screen.queryByText("Groceries")).toBeNull();
    });

    it("surfaces a matching subcategory with its parent as a breadcrumb", async () => {
        const db = await seededDb();
        addChild(db, "organic", "Organic", GROCERIES);
        await mount({ db });
        await type("organic");

        expect(screen.getByText("Organic")).toBeTruthy();
        expect(screen.getByTestId("category-crumb-organic")).toBeTruthy();
    });

    it("selects a subcategory straight from the results, without expanding its parent", async () => {
        const db = await seededDb();
        addChild(db, "organic", "Organic", GROCERIES);
        const picked: string[] = [];
        await mount({ db, onSelect: (category) => picked.push(category.id) });
        await type("organic");

        press("category-row-organic");
        expect(picked).toStrictEqual(["organic"]);
    });

    it("offers to create the typed name when nothing matches", async () => {
        const created: string[] = [];
        await mount({
            db: await seededDb(),
            onCreate: (name) => created.push(name),
        });
        await type("veterinary");

        expect(screen.getByText("transaction.category.noMatches:veterinary")).toBeTruthy();
        press("category-create");
        expect(created).toStrictEqual(["veterinary"]);
    });

    it("omits the create action when the host cannot create categories", async () => {
        await mount({ db: await seededDb() });
        await type("veterinary");

        expect(screen.queryByTestId("category-create")).toBeNull();
    });

    it("shows recently used categories ahead of the full list", async () => {
        const db = await seededDb();
        addTransaction(db, seededCategoryId("Rent", false), 2000);
        await mount({ db });

        expect(screen.getByTestId("category-recents")).toBeTruthy();
    });

    it("hides the recents rail on a ledger with no history", async () => {
        await mount({ db: await seededDb() });
        expect(screen.queryByTestId("category-recents")).toBeNull();
    });

    it("hides the recents rail while searching", async () => {
        const db = await seededDb();
        addTransaction(db, seededCategoryId("Rent", false), 2000);
        await mount({ db });
        await type("rent");

        expect(screen.queryByTestId("category-recents")).toBeNull();
    });
});
