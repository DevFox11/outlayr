import { parseCsv } from "@/domain/csv";

export type ParseFailureReason = "empty" | "noDataRows" | "tooFewColumns";

// Duplicates parseImportFile's header heuristic (data/transfer-core.ts); the two must stay in sync.
export function classifyParseFailure(text: string): ParseFailureReason {
	const lines = parseCsv(text);
	if (lines.length === 0) {
		return "empty";
	}

	const first = lines[0] ?? [];
	const looksLikeHeader = !/\d/.test(first.join(""));
	const rows = looksLikeHeader ? lines.slice(1) : lines;
	if (rows.length === 0) {
		return "noDataRows";
	}

	return "tooFewColumns";
}
