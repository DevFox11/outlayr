import type { ColumnMapping, ParsedImportFile } from "@/data/transfer-core";
import type { CategoryBranch } from "@/lib/convex";

export const MAX_LABELS = 200;

const LONG_DIGIT_RUN = /\d{4,}/g;

export function scrubLabel(raw: string): string {
	return raw.replace(LONG_DIGIT_RUN, "").replace(/\s+/g, " ").trim();
}

export interface ClassificationPayload {
	labels: string[];
	categoryTree: CategoryBranch[];
}

function dedupeLabels(raw: readonly string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const label of raw) {
		const scrubbed = scrubLabel(label);
		if (scrubbed.length === 0 || seen.has(scrubbed)) {
			continue;
		}
		seen.add(scrubbed);
		result.push(scrubbed);
	}
	return result;
}

export function buildClassificationPayload(args: {
	parsed: ParsedImportFile;
	draft: Record<keyof ColumnMapping, number | null>;
	unresolvedLabels: readonly string[];
	categoryTree: readonly CategoryBranch[];
}): ClassificationPayload | null {
	const labels = dedupeLabels(args.unresolvedLabels).slice(0, MAX_LABELS);
	if (labels.length === 0) {
		return null;
	}

	return {
		labels,
		categoryTree: args.categoryTree.map((branch) => ({
			name: branch.name,
			children: [...branch.children],
		})),
	};
}
