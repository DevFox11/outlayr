import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import type BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { Text } from "react-native";

import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";

import { useLiveValue, useRatesRead } from "./live-query";
import { bumpRatesRevision } from "./rates-revision";

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

async function fireAppMetaChange(rows = 1) {
    await act(async () => {
        for (let row = 0; row < rows; row += 1) {
            // oxlint-disable-next-line unicorn/no-useless-spread -- mirrors the copy the real listener list is iterated over
            for (const listener of [...mockChangeListeners]) {
                listener({ tableName: "appMeta" });
            }
        }
        // Change events reach live reads on the next tick, coalesced.
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
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

    it("re-reads once for a write's burst of row events, not once per row", async () => {
        let reads = 0;
        const { result } = await renderHook(() =>
            useLiveValue(
                appMeta,
                () => {
                    reads += 1;
                    return db.select().from(appMeta);
                },
                (rows) => rows.length
            )
        );
        const before = reads;

        write(db, "alpha", "one");
        await fireAppMetaChange(300);

        expect(reads - before).toBe(1);
        expect(result.current).toBe(1);
    });
});

describe("useRatesRead", () => {
    it("re-reads once per rates revision and never per written row", async () => {
        mockChangeListeners.clear();
        let reads = 0;
        const { result } = await renderHook(() =>
            useRatesRead(() => {
                reads += 1;
                return reads;
            })
        );

        await act(async () => {
            for (let row = 0; row < 300; row += 1) {
                // oxlint-disable-next-line unicorn/no-useless-spread -- mirrors the copy the real listener list is iterated over
                for (const listener of [...mockChangeListeners]) {
                    listener({ tableName: "exchangeRates" });
                }
            }
        });
        expect(reads).toBe(1);

        await act(async () => {
            bumpRatesRevision();
        });
        expect(reads).toBe(2);
        expect(result.current).toBe(2);
    });
});
