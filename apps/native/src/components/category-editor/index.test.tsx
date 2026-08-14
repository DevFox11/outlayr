import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, render } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import type { Database } from "@/db/client";
import { categories } from "@/db/schema";

import CategoryEditor from "./index";

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-sqlite", () => ({
    addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
    useColors: () => ({
        accent: "#3D7A5C",
        accentForeground: "#FFFFFF",
        background: "#F2F0EA",
        border: "#DAD6C9",
        danger: "#B5482F",
        expense: "#B5482F",
        foreground: "#17150F",
        future: "#8A8578",
        groupedBackground: "#EFEDE6",
        income: "#3D7A5C",
        muted: "#8A8578",
        overBudget: "#B5482F",
        railTrack: "rgba(0,0,0,0.08)",
        separator: "#DAD6C9",
        subtle: "#B4AFA0",
        surface: "#FFFFFF",
        surfaceSecondary: "#F7F5EF",
        tint: "#3D7A5C",
        warning: "#C08A2E",
    }),
}));
jest.mock("expo-router", () => ({
    useNavigation: () => ({ setOptions: jest.fn() }),
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

// `useNativeState` bridges to a real native `ObservableState` (SwiftUI/Jetpack
// Compose) that jest has no runtime for — unrelated to the reanimated/worklets
// fix in jest.config.js. This double keeps the get/set/onChange contract so
// `CategoryEditor`'s own hooks and its extracted sections can render; it does
// NOT simulate cross-thread synchronization or the native TextField binding.
interface ObservableStateDouble {
    get: () => unknown;
    onChange: unknown;
    set: (v: unknown) => void;
    value: unknown;
}

jest.mock("@expo/ui/swift-ui", () => {
    const actual = jest.requireActual("@expo/ui/swift-ui");
    const React = require("react");
    return {
        ...actual,
        useNativeState: (initial: unknown) => {
            const ref = React.useRef() as { current?: ObservableStateDouble };
            if (!ref.current) {
                let value = initial;
                let onChange: unknown = null;
                ref.current = {
                    get() {
                        return value;
                    },
                    get onChange() {
                        return onChange;
                    },
                    set onChange(fn: unknown) {
                        onChange = fn;
                    },
                    set(v: unknown) {
                        value = v;
                    },
                    get value() {
                        return value;
                    },
                    set value(v: unknown) {
                        value = v;
                    },
                } as unknown as ObservableStateDouble;
            }
            return ref.current;
        },
    };
});

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

function findByProp(node: JsonNode | JsonNode[] | null, key: string, value: unknown): JsonNode | null {
    if (node == null) {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findByProp(child, key, value);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (node.props?.[key] === value) {
        return node;
    }
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            continue;
        }
        const found = findByProp(child, key, value);
        if (found) {
            return found;
        }
    }
    return null;
}

function containsText(node: JsonNode | JsonNode[] | null, text: string): boolean {
    if (node == null) {
        return false;
    }
    if (Array.isArray(node)) {
        return node.some((child) => containsText(child, text));
    }
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            if (child === text) {
                return true;
            }
            continue;
        }
        if (containsText(child, text)) {
            return true;
        }
    }
    return false;
}

const MIGRATIONS = join(import.meta.dirname, "../../../drizzle");

function migratedDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    for (const file of readdirSync(MIGRATIONS)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        for (const statement of readFileSync(join(MIGRATIONS, file), "utf-8").split("--> statement-breakpoint")) {
            if (statement.trim()) {
                sqlite.exec(statement);
            }
        }
    }
    return drizzle(sqlite) as unknown as Database;
}

async function seedCategory(db: Database, overrides: Partial<typeof categories.$inferInsert> = {}) {
    const id = overrides.id ?? "c1";
    await db.insert(categories).values({
        color: "#3D7A5C",
        emoji: "🛒",
        id,
        income: false,
        name: "Groceries",
        sortOrder: 0,
        updatedAt: new Date(),
        ...overrides,
    });
    return id;
}

const dbHolder: { current: Database | null } = { current: null };

jest.mock("@/contexts/local-data-context", () => ({
    useDatabase: () => dbHolder.current,
    useLocalData: () => ({ db: dbHolder.current }),
}));

beforeEach(() => {
    dbHolder.current = migratedDb();
});

describe("categoryEditor", () => {
    it("renders create mode without crashing", async () => {
        const { toJSON } = await render(
            <IdentityDraftProvider>
                <CategoryEditor income={false} mode="create" />
            </IdentityDraftProvider>
        );
        expect(toJSON()).toBeTruthy();
    });

    it("renders edit mode without crashing once the row loads", async () => {
        const id = await seedCategory(dbHolder.current as Database);
        const { toJSON } = await render(
            <IdentityDraftProvider>
                <CategoryEditor id={id} mode="edit" />
            </IdentityDraftProvider>
        );
        expect(toJSON()).toBeTruthy();
    });

    it("plumbs the loaded row's identity into the hero band", async () => {
        const id = await seedCategory(dbHolder.current as Database, {
            emoji: "🎯",
        });
        const { toJSON } = await render(
            <IdentityDraftProvider>
                <CategoryEditor id={id} mode="edit" />
            </IdentityDraftProvider>
        );
        expect(containsText(toJSON() as JsonNode, "🎯")).toBe(true);
    });

    it("plumbs the loaded row's income flag into the details section placeholder", async () => {
        const id = await seedCategory(dbHolder.current as Database, {
            income: true,
        });
        const { toJSON } = await render(
            <IdentityDraftProvider>
                <CategoryEditor id={id} mode="edit" />
            </IdentityDraftProvider>
        );
        expect(findByProp(toJSON() as JsonNode, "placeholder", "categories.namePlaceholder.income")).not.toBeNull();
    });

    it("holds hook order across a create -> edit -> create re-render sequence", async () => {
        const id = await seedCategory(dbHolder.current as Database);
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const { rerender } = await render(
            <IdentityDraftProvider>
                <CategoryEditor income={false} mode="create" />
            </IdentityDraftProvider>
        );

        await act(async () => {
            rerender(
                <IdentityDraftProvider>
                    <CategoryEditor id={id} mode="edit" />
                </IdentityDraftProvider>
            );
        });
        await act(async () => {
            rerender(
                <IdentityDraftProvider>
                    <CategoryEditor income={true} mode="create" />
                </IdentityDraftProvider>
            );
        });

        const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
            typeof message === "string" ? /Rendered (more|fewer) hooks/.test(message) : false
        );
        expect(hookOrderViolations).toHaveLength(0);
        errorSpy.mockRestore();
    });

    it("holds hook order once the 24-expense-category limit forces income on", async () => {
        const db = dbHolder.current as Database;
        for (let i = 0; i < 24; i += 1) {
            await seedCategory(db, { id: `expense-${i}`, income: false });
        }
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const { rerender } = await render(
            <IdentityDraftProvider>
                <CategoryEditor income={false} mode="create" />
            </IdentityDraftProvider>
        );

        await act(async () => {
            rerender(
                <IdentityDraftProvider>
                    <CategoryEditor income={false} mode="create" parentId={null} />
                </IdentityDraftProvider>
            );
        });

        const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
            typeof message === "string" ? /Rendered (more|fewer) hooks/.test(message) : false
        );
        expect(hookOrderViolations).toHaveLength(0);
        errorSpy.mockRestore();
    });
});
