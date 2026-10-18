import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";

import type { Database } from "@/db/client";
import { unusedDatabase } from "@/db/test-database";

jest.mock("./recurrence-backfill", () => ({
    backfillAllRecurring: jest.fn(async () => undefined),
    repairOrphanedRecurrence: jest.fn(async () => undefined),
}));

import * as backfill from "./recurrence-backfill";
import { useRecurrenceSweep } from "./use-recurrence-sweep";

const mockBackfill = jest.mocked(backfill);
const onSwept = jest.fn<(db: Database) => void>();
let changeTo: (state: AppStateStatus) => void = () => undefined;
let now = 1_000_000;

beforeEach(() => {
    onSwept.mockClear();
    mockBackfill.backfillAllRecurring.mockClear();
    jest.spyOn(Date, "now").mockImplementation(() => now);
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
        changeTo = listener;
        return { remove: () => undefined };
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

async function foreground() {
    await act(async () => {
        changeTo("active");
    });
}

describe("useRecurrenceSweep", () => {
    it("calls onSwept once per launch and foreground, walking only outside the cooldown", async () => {
        await renderHook(() => {
            useRecurrenceSweep(unusedDatabase(), onSwept);
        });
        expect(mockBackfill.backfillAllRecurring).toHaveBeenCalledTimes(1);
        expect(onSwept).toHaveBeenCalledTimes(1);

        now += 10_000;
        await foreground();
        expect(mockBackfill.backfillAllRecurring).toHaveBeenCalledTimes(1);
        expect(onSwept).toHaveBeenCalledTimes(2);

        now += 60_000;
        await foreground();
        expect(mockBackfill.backfillAllRecurring).toHaveBeenCalledTimes(2);
        expect(onSwept).toHaveBeenCalledTimes(3);
    });
});
