import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import type BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { Text } from "react-native";

import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";

import { useLiveValue } from "./live-query";

type ChangeListener = (event: { tableName: string }) => void;

const mockChangeListeners = new Set<ChangeListener>();

jest.mock("expo-sqlite", () => ({
    addDatabaseChangeListener: (listener: ChangeListener) => {
        mockChangeListeners.add(listener);
        return {
            remove: () => {
                mockChangeListeners.delete(listener);
            },
        };
    },
}));

async function fireAppMetaChange() {
    await act(async () => {
        // oxlint-disable-next-line unicorn/no-useless-spread -- mirrors the copy the real listener list is iterated over
        for (const listener of [...mockChangeListeners]) {
            listener({ tableName: "appMeta" });
        }
    });
}

const makeDb = migratedDatabase;

function write(db: Database, key: string, value: string) {
    (db as unknown as { $client: BetterSqlite3.Database }).$client
        .prepare("INSERT INTO appMeta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(key, value);
}

let renders = 0;

function Probe({ db, watch }: { db: Database; watch: string }) {
    const value = useLiveValue(
        appMeta,
        () => db.select().from(appMeta).where(eq(appMeta.key, watch)),
        (rows) => rows[0]?.value ?? "unset",
        [watch]
    );
    renders += 1;
    return <Text testID="probe">{value}</Text>;
}

describe("useLiveValue", () => {
    let db: Database;

    beforeEach(() => {
        db = makeDb();
        mockChangeListeners.clear();
        renders = 0;
    });

    it("does not re-render when an invalidation leaves the derived value unchanged", async () => {
        const { getByTestId } = await render(<Probe db={db} watch="alpha" />);
        await waitFor(() => expect(getByTestId("probe").props.children).toBe("unset"));
        const before = renders;

        write(db, "beta", "irrelevant");
        await fireAppMetaChange();

        expect(renders).toBe(before);
        expect(getByTestId("probe").props.children).toBe("unset");
    });

    it("re-renders when the watched value changes", async () => {
        const { getByTestId } = await render(<Probe db={db} watch="alpha" />);
        await waitFor(() => expect(getByTestId("probe").props.children).toBe("unset"));
        const before = renders;

        write(db, "alpha", "one");
        await fireAppMetaChange();

        await waitFor(() => expect(getByTestId("probe").props.children).toBe("one"));
        expect(renders).toBeGreaterThan(before);
    });
});
