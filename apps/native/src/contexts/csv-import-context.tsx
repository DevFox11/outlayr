import { createContext, use, useEffect, useMemo } from "react";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { type CategoryMetaRow, useCategoryMeta } from "@/data/categories";
import {
	categoryKey,
	type ParsedImportFile,
	uniqueCategoryValues,
} from "@/data/transfer-core";
import type { MappingDraft } from "@/domain/import-mapping";
import { type UseCsvImportResult, useCsvImport } from "@/hooks/use-csv-import";
import { importDraftStore, useImportDraft } from "@/lib/import-draft-store";

const EMPTY_PARSED: ParsedImportFile = { header: null, rows: [], width: 0 };
const EMPTY_DRAFT: MappingDraft = {
	category: null,
	note: null,
	date: null,
	amount: null,
	currency: null,
	type: null,
};

function buildCategoryTree(meta: ReadonlyMap<string, CategoryMetaRow>) {
	const named = [...meta.entries()].filter(([, row]) => row.name != null);
	return named
		.filter(([, row]) => row.parentId == null)
		.map(([id, row]) => ({
			name: row.name as string,
			children: named
				.filter(([, child]) => child.parentId === id)
				.map(([, child]) => child.name as string),
		}));
}

function buildCategoryIdByKey(
	meta: ReadonlyMap<string, CategoryMetaRow>,
): Map<string, string> {
	const byKey = new Map<string, string>();
	for (const [id, row] of meta) {
		if (row.name == null) {
			continue;
		}
		const key = categoryKey(row.name);
		if (!byKey.has(key)) {
			byKey.set(key, id);
		}
	}
	return byKey;
}

const CsvImportContext = createContext<UseCsvImportResult | null>(null);

export function CsvImportProvider({ children }: { children: React.ReactNode }) {
	const db = useDatabase();
	const meta = useCategoryMeta(db);
	const aiEnrichment = useAppSettings().state.bool("aiEnrichment");
	const { flow: state } = useImportDraft();

	const categoryTree = useMemo(() => buildCategoryTree(meta), [meta]);
	const categoryIdByKey = useMemo(() => buildCategoryIdByKey(meta), [meta]);

	const labels = useMemo(() => {
		if (state.parsed == null || state.resolved == null) {
			return [];
		}
		return uniqueCategoryValues(
			state.parsed.rows,
			state.resolved.mapping.category,
		);
	}, [state.parsed, state.resolved]);

	const result = useCsvImport({
		parsed: state.parsed ?? EMPTY_PARSED,
		draft: state.draft ?? EMPTY_DRAFT,
		labels,
		chars: state.file?.chars ?? 0,
		categoryTree,
		categoryIdByKey,
		aiEnrichment,
		fileKey:
			state.file == null ? null : `${state.file.name}:${state.file.chars}`,
	});

	useEffect(() => {
		if (result.outcome == null) {
			return;
		}
		importDraftStore.dispatch({
			type: "resolutionSettled",
			outcome: result.outcome,
			reason: result.reason,
			links: result.links,
			fromModel: result.fromModel,
		});
	}, [result.outcome, result.reason, result.links, result.fromModel]);

	return (
		<CsvImportContext.Provider value={result}>
			{children}
		</CsvImportContext.Provider>
	);
}

export function useCsvImportContext(): UseCsvImportResult {
	const value = use(CsvImportContext);
	if (value == null) {
		throw new Error(
			"useCsvImportContext must be used within CsvImportProvider",
		);
	}
	return value;
}
