import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { LimitBucket, UsageLimits } from "@/domain/usage-limits";

import { useLimitNotice } from "./use-usage-limits";
import type { LimitRefusal } from "./use-usage-limits";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;

let mockLimits: UsageLimits | undefined;
jest.mock("convex/react", () => ({ useQuery: () => mockLimits }));
jest.mock("@/lib/convex", () => ({ USAGE_LIMITS_QUERY: "limits:mine" }));

function burst(value: number): LimitBucket {
    return { capacity: 50, kind: "token bucket", period: HOUR, rate: 200, ts: NOW, value };
}

function limits(receipts: number, captures = 400): UsageLimits {
    return {
        captures: { capacity: 500, kind: "fixed window", period: 30 * DAY, rate: 500, ts: NOW - DAY, value: captures },
        csvImport: burst(10),
        enrichment: burst(30),
        pro: true,
        receiptScan: burst(receipts),
        voiceEntry: burst(60),
    };
}

beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
    jest.useRealTimers();
});

describe("useLimitNotice", () => {
    it("says nothing about a bucket that was already empty when the screen opened", async () => {
        mockLimits = limits(0);
        const { result } = await renderHook(() => useLimitNotice("receiptScan", null));

        expect(result.current.notice).toBeNull();
    });

    it("raises the last-one notice when a call spends the final token, then lets it go", async () => {
        mockLimits = limits(1);
        const { result, rerender } = await renderHook(() => useLimitNotice("receiptScan", null));

        mockLimits = limits(0);
        await rerender({});

        expect(result.current.notice).toStrictEqual({ kind: "last", nextAt: NOW + 18_000 });
        await act(async () => {
            jest.advanceTimersByTime(6000);
        });
        expect(result.current.notice).toBeNull();
    });

    it("prefers the capture pool when the same call empties it", async () => {
        mockLimits = limits(1, 1);
        const { result, rerender } = await renderHook(() => useLimitNotice("receiptScan", null));

        mockLimits = limits(0, 0);
        await rerender({});

        expect(result.current.notice).toStrictEqual({ capacity: 500, kind: "capturesLast", resetsAt: NOW + 29 * DAY });
    });

    it("reads a refusal as paused until the next token, and drops it once one is back", async () => {
        mockLimits = limits(0);
        const { result } = await renderHook(
            ({ refusal }: { refusal: LimitRefusal | null }) => useLimitNotice("receiptScan", refusal),
            { initialProps: { refusal: "rateLimited" } }
        );

        expect(result.current.notice).toStrictEqual({ kind: "paused", nextAt: NOW + 18_000 });
        await act(async () => {
            jest.advanceTimersByTime(18_000);
        });
        expect(result.current.notice).toBeNull();
    });
});
