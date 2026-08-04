import { act, renderHook } from "@testing-library/react-native";
import { categoryKey, type ParsedImportFile } from "@/data/transfer-core";
import * as enrichmentCache from "@/domain/enrichment-cache";
import type { UnavailableReason } from "@/domain/import-flow";
import type { MappingDraft } from "@/domain/import-mapping";
import * as merchantResolver from "@/domain/merchant-resolver";
import type {
	CsvImportFn,
	CsvImportRequest,
	CsvImportResult,
	CsvImportStatus,
} from "@/lib/convex";
import {
	AI_TIER_MAX_CHARS,
	AI_TIER_MAX_ROWS,
	type UseCsvImportArgs,
	useCsvImport,
} from "./use-csv-import";

const PARSED: ParsedImportFile = {
	header: ["date", "description", "amount"],
	rows: [],
	width: 3,
};

const DRAFT: MappingDraft = {
	category: 1,
	note: 1,
	date: 0,
	amount: 2,
	currency: null,
	type: null,
};

const UNKNOWN = "zzq unresolvable merchant alpha";
const OTHER_UNKNOWN = "zzq unresolvable merchant beta";

function baseArgs(overrides: Partial<UseCsvImportArgs> = {}): UseCsvImportArgs {
	return {
		parsed: PARSED,
		draft: DRAFT,
		labels: [],
		chars: 100,
		categoryTree: [],
		categoryIdByKey: new Map(),
		aiEnrichment: true,
		transport: null,
		fileKey: "test-file",
		...overrides,
	};
}

interface DeferredCall {
	settle: (value: CsvImportResult) => void;
	reject: (error: unknown) => void;
}

function deferredTransport(): {
	fn: CsvImportFn & jest.Mock;
	calls: DeferredCall[];
} {
	const calls: DeferredCall[] = [];
	const fn = jest.fn(
		() =>
			new Promise<CsvImportResult>((resolve, reject) => {
				calls.push({ settle: resolve, reject });
			}),
	) as CsvImportFn & jest.Mock;
	return { fn, calls };
}

beforeEach(() => {
	enrichmentCache.clearEnrichmentCache();
});

describe("tier 1 resolves before any transport call", () => {
	it("settles applied with zero network calls when the merchant map resolves everything", async () => {
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: ["netflix"],
					categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
					transport: fn,
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(fn).not.toHaveBeenCalled();
		expect(result.current.outcome).toBe("applied");
		expect(result.current.reason).toBeNull();
		expect(result.current.links.get("netflix")).toBe("cat-entertainment");
		expect(result.current.tier1Matched).toBe(1);
	});
});

describe("tier 2: exactly one call per import", () => {
	it("calls the transport exactly once for several unresolved labels", async () => {
		const { fn, calls } = deferredTransport();
		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: [UNKNOWN, OTHER_UNKNOWN, `${UNKNOWN} again`],
					transport: fn,
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});
		expect(fn).toHaveBeenCalledTimes(1);

		await act(async () => {
			calls[0].settle({ status: "ok", suggestions: [] });
		});
		expect(fn).toHaveBeenCalledTimes(1);
		expect(result.current.outcome).toBe("applied");
	});

	it("ignores a second run() call while one is already in flight", async () => {
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })),
		);

		await act(async () => {
			result.current.run();
			result.current.run();
		});

		expect(fn).toHaveBeenCalledTimes(1);
	});
});

describe("aiEnrichment setting off", () => {
	it("never calls the transport and settles declined", async () => {
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({ labels: [UNKNOWN], aiEnrichment: false, transport: fn }),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(fn).not.toHaveBeenCalled();
		expect(result.current.outcome).toBe("declined");
		expect(result.current.reason).toBeNull();
	});
});

describe("over cap — the AI tier is gated, not the import", () => {
	it("skips the transport when characters exceed the AI tier cap, but a plan still reaches review", async () => {
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: ["netflix", UNKNOWN],
					categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
					chars: AI_TIER_MAX_CHARS + 1,
					transport: fn,
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(fn).not.toHaveBeenCalled();
		expect(result.current.outcome).toBe("unavailable");
		expect(result.current.reason).toBe("overCap");
		expect(result.current.links.size).toBeGreaterThan(0);
		expect(result.current.links.get("netflix")).toBe("cat-entertainment");
	});

	it("skips the transport when the parsed row count exceeds the AI tier cap, but a plan still reaches review", async () => {
		const { fn } = deferredTransport();
		const manyRows = Array.from({ length: AI_TIER_MAX_ROWS + 1 }, () => [
			"01/08/2026",
			"x",
			"1,00",
		]);
		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: ["netflix", UNKNOWN],
					categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
					parsed: { ...PARSED, rows: manyRows },
					transport: fn,
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(fn).not.toHaveBeenCalled();
		expect(result.current.outcome).toBe("unavailable");
		expect(result.current.reason).toBe("overCap");
		expect(result.current.links.size).toBeGreaterThan(0);
		expect(result.current.links.get("netflix")).toBe("cat-entertainment");
	});
});

describe("transport failure never throws", () => {
	it("a rejecting transport settles unavailable with reason offline", async () => {
		const fn: CsvImportFn = jest.fn(() =>
			Promise.reject(new Error("network down")),
		);
		const { result } = await renderHook(() =>
			useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })),
		);

		await act(async () => {
			result.current.run();
		});

		expect(result.current.outcome).toBe("unavailable");
		expect(result.current.reason).toBe("offline");
	});

	it("has not resolved just before 15000ms and has resolved just after", async () => {
		jest.useFakeTimers();
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })),
		);

		await act(async () => {
			result.current.run();
		});
		expect(result.current.running).toBe(true);

		await act(async () => {
			jest.advanceTimersByTime(14_999);
		});
		expect(result.current.running).toBe(true);
		expect(result.current.outcome).toBeNull();

		await act(async () => {
			jest.advanceTimersByTime(2);
		});
		expect(result.current.running).toBe(false);
		expect(result.current.outcome).toBe("unavailable");
		expect(result.current.reason).toBe("timeout");
		jest.useRealTimers();
	});
});

describe("each server status maps to its own reason", () => {
	const cases: Array<[CsvImportStatus, UnavailableReason]> = [
		["notConfigured", "notConfigured"],
		["rateLimited", "rateLimited"],
		["invalidResponse", "invalidResponse"],
		["providerError", "providerError"],
		["invalid", "providerError"],
		["unauthenticated", "unauthenticated"],
	];

	for (const [status, reason] of cases) {
		it(`maps "${status}" to "${reason}"`, async () => {
			const fn: CsvImportFn = jest.fn(() =>
				Promise.resolve({ status, suggestions: null }),
			);
			const { result } = await renderHook(() =>
				useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })),
			);

			await act(async () => {
				result.current.run();
			});

			expect(result.current.outcome).toBe("unavailable");
			expect(result.current.reason).toBe(reason);
		});
	}
});

describe("enrichment-cache boundary (A10)", () => {
	it("never writes to the enrichment cache, even after a successful model response", async () => {
		const setSpy = jest.spyOn(enrichmentCache, "setCachedEnrichment");
		const fn: CsvImportFn = jest.fn(() =>
			Promise.resolve({
				status: "ok" as const,
				suggestions: [{ label: UNKNOWN, categoryName: "Food" }],
			}),
		);
		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: [UNKNOWN],
					categoryIdByKey: new Map([["food", "cat-food"]]),
					transport: fn,
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(result.current.outcome).toBe("applied");
		expect(result.current.links.get(UNKNOWN)).toBe("cat-food");
		expect(setSpy).not.toHaveBeenCalled();
	});

	it("reuses a cache entry left by the single-transaction enrichment flow, skipping the transport for that label", async () => {
		enrichmentCache.setCachedEnrichment(merchantResolver.merchantKey(UNKNOWN), {
			categoryName: "Food",
			isNewCategory: false,
			tags: [],
			domain: null,
		});
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: [UNKNOWN],
					categoryIdByKey: new Map([["food", "cat-food"]]),
					transport: fn,
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(fn).not.toHaveBeenCalled();
		expect(result.current.outcome).toBe("applied");
		expect(result.current.links.get(UNKNOWN)).toBe("cat-food");
	});
});

describe("raw ↔ scrubbed label correspondence", () => {
	it("resolves the link by the RAW label's key, not the scrubbed label the payload sends", async () => {
		const raw = `${UNKNOWN} 1234567`;
		const fn = jest.fn((payload: CsvImportRequest) => {
			expect(payload.labels).toEqual([UNKNOWN]);
			return Promise.resolve({
				status: "ok" as const,
				suggestions: [{ label: UNKNOWN, categoryName: "Shopping" }],
			});
		}) as CsvImportFn & jest.Mock;

		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: [raw],
					categoryIdByKey: new Map([["shopping", "cat-shopping"]]),
					transport: fn,
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(result.current.outcome).toBe("applied");
		expect(result.current.links.get(categoryKey(raw))).toBe("cat-shopping");
	});
});

describe("no backend configured", () => {
	it("settles unavailable/notConfigured (non-retryable) rather than calling nothing silently", async () => {
		const { result } = await renderHook(() =>
			useCsvImport(baseArgs({ labels: [UNKNOWN], transport: null })),
		);

		await act(async () => {
			result.current.run();
		});

		expect(result.current.outcome).toBe("unavailable");
		expect(result.current.reason).toBe("notConfigured");
	});
});

describe("changing the selected file resets a settled resolution", () => {
	it("clears outcome, links, and counters so the CTA returns", async () => {
		const { fn } = deferredTransport();
		const { result, rerender } = await renderHook(
			(props: UseCsvImportArgs) => useCsvImport(props),
			{
				initialProps: baseArgs({
					fileKey: "file-a",
					labels: ["netflix"],
					categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
					transport: fn,
				}),
			},
		);

		await act(async () => {
			result.current.run();
		});

		expect(result.current.outcome).toBe("applied");
		expect(result.current.tier1Matched).toBe(1);
		expect(result.current.links.size).toBe(1);

		await rerender(
			baseArgs({ fileKey: "file-b", labels: [UNKNOWN], transport: fn }),
		);

		expect(result.current.outcome).toBeNull();
		expect(result.current.tier1Matched).toBe(0);
		expect(result.current.tier2Sent).toBe(0);
		expect(result.current.links.size).toBe(0);
		expect(result.current.running).toBe(false);
	});
});

describe("any throw during the run settles unavailable instead of rejecting", () => {
	it("recovers when on-device resolution throws", async () => {
		const spy = jest
			.spyOn(merchantResolver, "resolveMerchant")
			.mockImplementation(() => {
				throw new Error("boom");
			});

		const { result } = await renderHook(() =>
			useCsvImport(baseArgs({ labels: [UNKNOWN] })),
		);

		await act(async () => {
			result.current.run();
		});

		expect(result.current.running).toBe(false);
		expect(result.current.outcome).toBe("unavailable");
		spy.mockRestore();
	});

	it("keeps on-device links and matching counters when a throw follows the tier-1 pass", async () => {
		const spy = jest
			.spyOn(enrichmentCache, "getCachedEnrichment")
			.mockImplementation(() => {
				throw new Error("boom");
			});

		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: ["netflix", UNKNOWN],
					categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(result.current.running).toBe(false);
		expect(result.current.outcome).toBe("unavailable");
		expect(result.current.tier1Matched).toBe(1);
		expect(result.current.links.size).toBe(result.current.tier1Matched);
		expect(result.current.links.get("netflix")).toBe("cat-entertainment");
		spy.mockRestore();
	});

	it("recovers when suggestion post-processing throws", async () => {
		const throwingCategoryIdByKey = {
			get(key: string) {
				if (key === categoryKey("boom")) {
					throw new Error("boom");
				}
				return undefined;
			},
		} as unknown as ReadonlyMap<string, string>;
		const fn: CsvImportFn = jest.fn(() =>
			Promise.resolve({
				status: "ok" as const,
				suggestions: [{ label: UNKNOWN, categoryName: "boom" }],
			}),
		);

		const { result } = await renderHook(() =>
			useCsvImport(
				baseArgs({
					labels: [UNKNOWN],
					categoryIdByKey: throwingCategoryIdByKey,
					transport: fn,
				}),
			),
		);

		await act(async () => {
			result.current.run();
		});

		expect(result.current.running).toBe(false);
		expect(result.current.outcome).toBe("unavailable");
	});
});
