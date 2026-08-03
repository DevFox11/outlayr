import type { ColumnMapping } from "@/data/transfer-core";

export type LabelSource = "categoryColumn" | "descriptionColumn";
export type MappingGap = "noLabelColumn" | "noDate" | "noAmount";
export type MappingDraft = Record<keyof ColumnMapping, number | null>;

export interface ResolvedMapping {
	mapping: ColumnMapping;
	labelSource: LabelSource;
}

export type MappingResolution =
	| { ok: true; value: ResolvedMapping }
	| { ok: false; gaps: readonly MappingGap[] };

export function resolveImportMapping(draft: MappingDraft): MappingResolution {
	const gaps: MappingGap[] = [];
	const labelSource: LabelSource =
		draft.category != null ? "categoryColumn" : "descriptionColumn";
	const category = draft.category ?? draft.note;

	if (category == null) {
		gaps.push("noLabelColumn");
	}
	if (draft.date == null) {
		gaps.push("noDate");
	}
	if (draft.amount == null) {
		gaps.push("noAmount");
	}

	if (category == null || draft.date == null || draft.amount == null) {
		return { ok: false, gaps };
	}

	return {
		ok: true,
		value: {
			mapping: {
				category,
				note: draft.note,
				date: draft.date,
				amount: draft.amount,
				currency: draft.currency,
				type: draft.type,
			},
			labelSource,
		},
	};
}
