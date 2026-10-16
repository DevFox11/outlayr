import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { eq } from "drizzle-orm";
import { Pressable } from "react-native";

import { IdentityDraftProvider, useIdentityDraft, useIdentityFlyUp } from "@/contexts/identity-draft-context";
import { testLocalData as mockTestLocalData } from "@/contexts/test-local-data";
import type { Database } from "@/db/client";
import { categories } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { testColors as mockTestColors } from "@/theme/test-colors";

import CategoryEditor from "./index.android";

const mockDb: { current: Database | null } = { current: null };
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockRequestDelete = jest.fn();

jest.mock<Partial<typeof import("@react-native-async-storage/async-storage")>>(
    "@react-native-async-storage/async-storage",
    () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock<Partial<typeof import("expo-sqlite")>>("expo-sqlite", () => ({
    addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("expo-router", () => ({
    useRouter: () => ({ back: mockBack, push: mockPush }),
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock("@/theme/use-material-colors", () => ({
    useMaterialColors: () => new Proxy({}, { get: () => "#336699" }),
}));
jest.mock<Partial<typeof import("react-native-safe-area-context")>>("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock("@/contexts/local-data-context", () => ({
    useDatabase: () => mockDb.current,
    useLocalData: () => mockTestLocalData({ db: mockDb.current }),
}));
jest.mock("@/data/use-deferred-delete", () => ({
    useDeferredDelete: () => ({ requestDelete: mockRequestDelete }),
}));
// The sheet header's Android sibling is the one with buttons in it; the plain
// file renders nothing because iOS keeps its native toolbar.
jest.mock("@/components/sheet-header", () => jest.requireActual("@/components/sheet-header.android"));
// The Compose dropdown has no jest runtime: an RN stand-in with the same contract.
jest.mock("@/components/material/outlined-dropdown-field", () => {
    const { Pressable: Option } = require("react-native") as typeof import("react-native");
    return {
        OutlinedDropdownField: ({
            options,
            onChange,
        }: import("@/components/material/outlined-dropdown-field").OutlinedDropdownFieldProps<string>) =>
            options.map((option) => (
                <Option accessibilityLabel={option.label} key={option.value} onPress={() => onChange(option.value)} />
            )),
    };
});

/** What the identity picker route does with a pick: the draft takes it, and the picker closes. */
function PickerStandIn() {
    const { draft, setDraft } = useIdentityDraft();
    const { setPickerOpen } = useIdentityFlyUp();
    return (
        <Pressable
            accessibilityLabel="pick the bus icon"
            onPress={() => {
                setDraft({ ...draft, emoji: null, icon: "Bus01", photoColor: null, photoUri: null });
                setPickerOpen(false);
            }}
        />
    );
}

function renderEditor(props: Parameters<typeof CategoryEditor>[0]) {
    return render(
        <IdentityDraftProvider>
            <CategoryEditor {...props} />
            <PickerStandIn />
        </IdentityDraftProvider>
    );
}

async function seedCategory(values: Partial<typeof categories.$inferInsert> & { id: string; name: string }) {
    await (mockDb.current as Database).insert(categories).values({
        color: "#4D84BD",
        icon: "Bus01",
        income: false,
        sortOrder: 0,
        updatedAt: new Date(),
        ...values,
    });
}

async function nameAndPick(name: string) {
    await act(async () => {
        fireEvent.changeText(screen.getByLabelText("categories.field.name"), name);
    });
    await act(async () => {
        fireEvent.press(screen.getByLabelText("transaction.identity.hero.icon"));
    });
    await act(async () => {
        fireEvent.press(screen.getByLabelText("pick the bus icon"));
    });
}

const save = () => screen.getByRole("button", { name: "common.save" });
const rowsNamed = (name: string) =>
    (mockDb.current as Database).select().from(categories).where(eq(categories.name, name));

beforeEach(() => {
    mockDb.current = migratedDatabase();
    mockBack.mockClear();
    mockPush.mockClear();
    mockRequestDelete.mockClear();
});

describe("android category editor", () => {
    it("keeps Save disabled until the category has a name and a symbol", async () => {
        await renderEditor({ mode: "create" });
        await act(async () => {
            fireEvent.changeText(screen.getByLabelText("categories.field.name"), "Pets");
        });
        expect(save()).toBeDisabled();

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.identity.hero.icon"));
        });
        await act(async () => {
            fireEvent.press(screen.getByLabelText("pick the bus icon"));
        });
        expect(save()).toBeEnabled();
    });

    it("stays up after a top-level add, cleared for the next one", async () => {
        await renderEditor({ mode: "create" });
        await nameAndPick("Pets");
        await act(async () => {
            fireEvent.press(save());
        });

        await waitFor(() => expect(screen.getByText("categories.toast.added")).toBeOnTheScreen());
        expect(screen.getByLabelText("categories.field.name").props.value).toBe("");
        expect(mockBack).not.toHaveBeenCalled();
        const [added] = await rowsNamed("Pets");
        expect({ icon: added?.icon, income: added?.income, parentId: added?.parentId }).toStrictEqual({
            icon: "Bus01",
            income: false,
            parentId: null,
        });
    });

    it("returns to the parent after adding a subcategory in its colour", async () => {
        // Not the bus the stand-in picks: a subcategory can't share its parent's icon.
        await seedCategory({ color: "#A97332", icon: "Restaurant01", id: "food", name: "Food" });
        await renderEditor({ mode: "create", parentId: "food" });
        await nameAndPick("Snacks");
        await act(async () => {
            fireEvent.press(save());
        });

        await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
        const [added] = await rowsNamed("Snacks");
        expect({ color: added?.color, parentId: added?.parentId }).toStrictEqual({
            color: "#A97332",
            parentId: "food",
        });
    });

    it("warns about the subcategories a delete takes with it, then closes", async () => {
        await seedCategory({ id: "food", name: "Food" });
        await seedCategory({ id: "snacks", name: "Snacks", parentId: "food" });
        await renderEditor({ id: "food", mode: "edit" });

        await act(async () => {
            fireEvent.press(screen.getByRole("button", { name: "common.delete" }));
        });

        await waitFor(() => expect(mockRequestDelete).toHaveBeenCalledWith("food", "categories.undo.bodyWithChildren"));
        expect(mockBack).toHaveBeenCalledTimes(1);
    });
});
