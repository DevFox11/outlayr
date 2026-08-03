import { renderHook } from "@testing-library/react-native";
import { clearEnrichmentCache } from "@/domain/enrichment-cache";
import {
	type EnrichmentSuggestion,
	type UseTransactionEnrichmentArgs,
	useTransactionEnrichment,
} from "./use-transaction-enrichment";

const DEBOUNCE_MS = 600;

function baseArgs(
	overrides: Partial<UseTransactionEnrichmentArgs> = {},
): UseTransactionEnrichmentArgs {
	return {
		enabled: true,
		income: false,
		knownCategoryNames: [],
		resolveLocal: (suggestion) => suggestion,
		onSuggest: () => {},
		...overrides,
	};
}

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
		});
		expect(result.current.categoryPending).toBe(false);
		expect(result.current.tagsPending).toBe(false);
	});

	it("does not emit for a merchant name shorter than the 3-character floor", async () => {
		const onSuggest = jest.fn();
		const { result } = await renderHook(() =>
			useTransactionEnrichment(baseArgs({ onSuggest })),
		);

		result.current.onNameChange("hi");
		jest.advanceTimersByTime(DEBOUNCE_MS);

		expect(onSuggest).not.toHaveBeenCalled();
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
		expect(result.current.categoryPending).toBe(false);
		expect(result.current.tagsPending).toBe(false);
	});
});
