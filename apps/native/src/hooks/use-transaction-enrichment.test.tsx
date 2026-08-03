import { act, renderHook } from "@testing-library/react-native";
import {
	clearEnrichmentCache,
	getCachedEnrichment,
	type RemoteEnrichmentResult,
} from "@/domain/enrichment-cache";
import { merchantKey } from "@/domain/merchant-resolver";
import type { EnrichmentFn, EnrichmentRequest } from "@/lib/convex";
import {
	type EnrichmentSuggestion,
	REMOTE_TIMEOUT_MS,
	type UseTransactionEnrichmentArgs,
	useTransactionEnrichment,
} from "./use-transaction-enrichment";

const DEBOUNCE_MS = 600;
const UNKNOWN = "zzq unresolvable merchant alpha";
const OTHER_UNKNOWN = "zzq unresolvable merchant beta";

/**
 * `transport: null` by default — the real one resolves a Convex client, and a
 * test that forgot to inject would otherwise reach for the network.
 */
function baseArgs(
	overrides: Partial<UseTransactionEnrichmentArgs> = {},
): UseTransactionEnrichmentArgs {
	return {
		enabled: true,
		income: false,
		categoryTree: [],
		resolveLocal: (suggestion) => suggestion,
		onSuggest: () => {},
		transport: null,
		...overrides,
	};
}

interface DeferredCall {
	args: EnrichmentRequest;
	settle: (value: RemoteEnrichmentResult | null) => void;
}

function deferredTransport(): {
	fn: EnrichmentFn & jest.Mock;
	calls: DeferredCall[];
} {
	const calls: DeferredCall[] = [];
	const fn = jest.fn(
		(args: EnrichmentRequest) =>
			new Promise<RemoteEnrichmentResult>((resolve) => {
				calls.push({
					args,
					settle: (value) => resolve(value as RemoteEnrichmentResult),
				});
			}),
	) as EnrichmentFn & jest.Mock;
	return { fn, calls };
}

const REMOTE_RESULT: RemoteEnrichmentResult = {
	categoryName: "Entertainment",
	isNewCategory: false,
	tags: ["Streaming"],
	domain: "example.com",
};

beforeEach(() => {
	jest.useFakeTimers();
	clearEnrichmentCache();
});

afterEach(() => {
	jest.useRealTimers();
});

describe("debouncing", () => {
	it("collapses 20 rapid keystrokes into exactly one suggestion at 600ms", async () => {
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ onSuggest })),
		);

		const target = "netflix";
		const keystrokes = [
			...target.split("").map((_, i) => target.slice(0, i + 1)),
			...Array.from({ length: 13 }, () => target),
		];
		expect(keystrokes.length).toBe(20);

		for (const partial of keystrokes) {
			result.current.onNameChange(partial);
		}

		jest.advanceTimersByTime(DEBOUNCE_MS - 1);
		expect(onSuggest).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		expect(onSuggest).toHaveBeenCalledTimes(1);

		jest.advanceTimersByTime(DEBOUNCE_MS * 2);
		expect(onSuggest).toHaveBeenCalledTimes(1);
	});
});

describe("tier 1: curated match", () => {
	it("emits a curated suggestion synchronously with zero pending flags", async () => {
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ onSuggest })),
		);

		result.current.onNameChange("netflix");
		jest.advanceTimersByTime(DEBOUNCE_MS);

		expect(onSuggest).toHaveBeenCalledTimes(1);
		const suggestion = onSuggest.mock.calls[0][0] as EnrichmentSuggestion;
		expect(suggestion.source).toBe("curated");
		expect(suggestion.domain).toBe("netflix.com");
		expect(suggestion.pendingTagNames).toStrictEqual([
			"Streaming",
			"Subscription",
		]);
		expect(suggestion.pendingCategory).toStrictEqual({
			name: "Entertainment",
			icon: "FilmRoll01",
			color: "#AF52DE",
			emoji: null,
			parentName: null,
		});
		expect(result.current.pending).toBe(false);
	});

	it("reports an empty suggestion below the 3-character floor so stale fields clear", async () => {
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ onSuggest })),
		);

		result.current.onNameChange("netflix");
		jest.advanceTimersByTime(DEBOUNCE_MS);
		expect(onSuggest).toHaveBeenLastCalledWith(
			expect.objectContaining({ domain: "netflix.com" }),
		);

		// Silence here would leave Netflix's category and logo on an entry that
		// is no longer Netflix.
		result.current.onNameChange("hi");
		jest.advanceTimersByTime(DEBOUNCE_MS);
		expect(onSuggest).toHaveBeenLastCalledWith({
			categoryId: null,
			pendingCategory: null,
			tagIds: [],
			pendingTagNames: [],
			domain: null,
			source: "curated",
		});
	});

	it("does not emit for a merchant name with no curated or remote match", async () => {
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ onSuggest })),
		);

		result.current.onNameChange("a wholly made up merchant name");
		jest.advanceTimersByTime(DEBOUNCE_MS);

		expect(onSuggest).not.toHaveBeenCalled();
	});

	it("passes the raw curated candidate through resolveLocal before emitting", async () => {
		const resolveLocal = jest.fn(
			(suggestion: EnrichmentSuggestion): EnrichmentSuggestion => ({
				...suggestion,
				categoryId: "resolved-category-id",
				pendingCategory: null,
			}),
		);
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ resolveLocal, onSuggest })),
		);

		result.current.onNameChange("netflix");
		jest.advanceTimersByTime(DEBOUNCE_MS);

		expect(resolveLocal).toHaveBeenCalledTimes(1);
		expect(onSuggest).toHaveBeenCalledWith(
			expect.objectContaining({
				categoryId: "resolved-category-id",
				pendingCategory: null,
			}),
		);
	});
});

describe("tier 2: remote fallback", () => {
	it("never calls the transport when tier 1 already answered", async () => {
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ transport: fn })),
		);

		result.current.onNameChange("netflix");
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});

		expect(fn).not.toHaveBeenCalled();
	});

	it("issues exactly one call for 20 keystrokes of an unknown merchant", async () => {
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ transport: fn })),
		);

		for (let index = 0; index < 20; index++) {
			result.current.onNameChange(UNKNOWN.slice(0, 10 + (index % 10)));
		}
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});

		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("sends only the merchant name and the user's own category names", async () => {
		const { fn, calls } = deferredTransport();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(
				baseArgs({
					transport: fn,
					categoryTree: [{ name: "Groceries", children: [] }],
				}),
			),
		);

		result.current.onNameChange(UNKNOWN);
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});

		expect(Object.keys(calls[0].args).sort()).toStrictEqual([
			"categoryTree",
			"income",
			"locale",
			"name",
		]);
	});

	it("reuses a cached negative result rather than calling again", async () => {
		const { fn, calls } = deferredTransport();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ transport: fn })),
		);

		result.current.onNameChange(UNKNOWN);
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});
		await act(async () => {
			calls[0].settle(null);
		});
		expect(fn).toHaveBeenCalledTimes(1);

		result.current.onNameChange(UNKNOWN);
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});

		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("drops a stale result once a newer request supersedes it", async () => {
		const { fn, calls } = deferredTransport();
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ onSuggest, transport: fn })),
		);

		result.current.onNameChange(UNKNOWN);
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});
		result.current.onNameChange(OTHER_UNKNOWN);
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});
		expect(calls.length).toBe(2);

		await act(async () => {
			calls[0].settle(REMOTE_RESULT);
		});

		expect(onSuggest).not.toHaveBeenCalled();
		expect(getCachedEnrichment(merchantKey(UNKNOWN))).toStrictEqual({
			hit: false,
		});
	});

	it("makes no call when the setting is off, and tier 1 still resolves", async () => {
		const { fn } = deferredTransport();
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(
				baseArgs({ onSuggest, transport: fn, remoteEnabled: false }),
			),
		);

		result.current.onNameChange(UNKNOWN);
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});
		expect(fn).not.toHaveBeenCalled();

		result.current.onNameChange("netflix");
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});
		// Twice: the empty report for the unresolvable name, then the curated hit.
		expect(onSuggest).toHaveBeenCalledTimes(2);
		expect(onSuggest).toHaveBeenLastCalledWith(
			expect.objectContaining({ domain: "netflix.com", source: "curated" }),
		);
		expect(fn).not.toHaveBeenCalled();
	});

	it("makes no call and raises nothing when there is no backend", async () => {
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ onSuggest, transport: null })),
		);

		result.current.onNameChange(UNKNOWN);
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});

		expect(onSuggest).not.toHaveBeenCalled();
		expect(result.current.pending).toBe(false);
	});

	it("gives up at the abort budget and caches the miss", async () => {
		const { fn } = deferredTransport();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ transport: fn })),
		);

		result.current.onNameChange(UNKNOWN);
		await act(async () => {
			jest.advanceTimersByTime(DEBOUNCE_MS);
		});
		expect(result.current.pending).toBe(true);

		await act(async () => {
			jest.advanceTimersByTime(REMOTE_TIMEOUT_MS + 1);
		});

		expect(result.current.pending).toBe(false);
		expect(getCachedEnrichment(merchantKey(UNKNOWN))).toStrictEqual({
			hit: true,
			value: null,
		});
	});
});

describe("unmount and disable", () => {
	it("clears the pending timer on unmount so a settling debounce never fires", async () => {
		const onSuggest = jest.fn();
		const { result, unmount } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ onSuggest })),
		);

		result.current.onNameChange("netflix");
		await unmount();
		jest.advanceTimersByTime(DEBOUNCE_MS);

		expect(onSuggest).not.toHaveBeenCalled();
	});

	it("is fully inert when disabled: no timer, no suggestion, constant pending flags", async () => {
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ enabled: false, onSuggest })),
		);

		result.current.onNameChange("netflix");
		jest.advanceTimersByTime(DEBOUNCE_MS);

		expect(onSuggest).not.toHaveBeenCalled();
		expect(result.current.pending).toBe(false);
	});
});
