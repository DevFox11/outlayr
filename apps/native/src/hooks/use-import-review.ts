import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";
import { useDatabase } from "@/contexts/local-data-context";
import { useLiveQuery } from "@/data/live-query";
import {
	applyImport,
	buildImportPlan,
	type ImportEntry,
	type ImportPlan,
	type SkipReason,
} from "@/data/transfer-core";
import { categories, transactions } from "@/db/schema";
import { fingerprintsOf, flagDuplicates } from "@/domain/import-dedup";
import type { ImportCommitState } from "@/domain/import-flow";
import {
	deduceDateFormat,
	detectDecimalSeparator,
} from "@/domain/transaction-csv";
import { useTranslation } from "@/i18n";
import { importDraftStore, useImportDraft } from "@/lib/import-draft-store";
import { useHaptics } from "@/lib/use-haptics";

export type ReviewRow =
	| {
			kind: "entry";
			key: string;
			index: number;
			entry: ImportEntry;
			duplicate: boolean;
	  }
	| { kind: "header"; key: "skipped-header"; count: number }
	| { kind: "skipped"; key: string; row: number; reason: SkipReason };

export function buildReviewRows(
	plan: ImportPlan,
	duplicates: ReadonlySet<number>,
): ReviewRow[] {
	const rows: ReviewRow[] = plan.entries.map((entry, index) => ({
		kind: "entry",
		key: `entry-${index}`,
		index,
		entry,
		duplicate: duplicates.has(index),
	}));
	if (plan.skipped.length > 0) {
		rows.push({
			kind: "header",
			key: "skipped-header",
			count: plan.skipped.length,
		});
		for (const skipped of plan.skipped) {
			rows.push({
				kind: "skipped",
				key: `skipped-${skipped.row}`,
				row: skipped.row,
				reason: skipped.reason,
			});
		}
	}
	return rows;
}

function sameMembers(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
	if (a.size !== b.size) {
		return false;
	}
	for (const value of a) {
		if (!b.has(value)) {
			return false;
		}
	}
	return true;
}

const EMPTY_PLAN: ImportPlan = {
	entries: [],
	skipped: [],
	earliest: null,
	latest: null,
};

export interface ImportReviewResult {
	plan: ImportPlan;
	rows: ReviewRow[];
	excluded: ReadonlySet<number>;
	selectedCount: number;
	categoryName: ReadonlyMap<string, string>;
	commit: ImportCommitState;
	onToggle: (index: number) => void;
	onCommit: () => void;
}

export function useImportReview(): ImportReviewResult {
	const t = useTranslation();
	const router = useRouter();
	const haptics = useHaptics();
	const db = useDatabase();
	const { flow } = useImportDraft();

	const categoryRows = useLiveQuery(categories, () =>
		db
			.select({
				id: categories.id,
				name: categories.name,
				income: categories.income,
			})
			.from(categories)
			.where(isNull(categories.deletedAt)),
	);
	const { categoryIncome, categoryName } = useMemo(() => {
		const income = new Map<string, boolean>();
		const name = new Map<string, string>();
		for (const row of categoryRows) {
			income.set(row.id, row.income);
			if (row.name != null) {
				name.set(row.id, row.name);
			}
		}
		return { categoryIncome: income, categoryName: name };
	}, [categoryRows]);

	const plan = useMemo(() => {
		if (flow.parsed == null || flow.resolved == null) {
			return EMPTY_PLAN;
		}
		const { mapping } = flow.resolved;
		const rows = flow.parsed.rows;
		const dateFormat =
			deduceDateFormat(rows.map((row) => row[mapping.date] ?? "")) ?? "";
		const decimal = detectDecimalSeparator(
			rows.map((row) => row[mapping.amount] ?? ""),
		);
		return buildImportPlan(
			rows,
			mapping,
			dateFormat,
			decimal,
			flow.resolution?.links ?? new Map(),
			categoryIncome,
		);
	}, [flow.parsed, flow.resolved, flow.resolution, categoryIncome]);

	const existingRows = useLiveQuery(
		transactions,
		() =>
			db
				.select({
					date: transactions.date,
					amount: transactions.amount,
					income: transactions.income,
					note: transactions.note,
				})
				.from(transactions)
				.where(
					plan.earliest == null || plan.latest == null
						? eq(transactions.id, "")
						: and(
								isNull(transactions.deletedAt),
								gte(transactions.date, plan.earliest),
								lte(transactions.date, plan.latest),
							),
				),
		[plan.earliest, plan.latest],
	);

	const duplicates = useMemo(
		() => flagDuplicates(plan.entries, fingerprintsOf(existingRows)),
		[plan.entries, existingRows],
	);

	useEffect(() => {
		if (sameMembers(duplicates, flow.duplicates)) {
			return;
		}
		importDraftStore.dispatch({
			type: "duplicatesFlagged",
			indices: duplicates,
		});
	}, [duplicates, flow.duplicates]);

	const rows = useMemo(
		() => buildReviewRows(plan, flow.duplicates),
		[plan, flow.duplicates],
	);

	const selectedCount = plan.entries.filter(
		(_, index) => !flow.excluded.has(index),
	).length;

	const onToggle = useCallback((index: number) => {
		importDraftStore.dispatch({ type: "rowToggled", index });
	}, []);

	const onCommit = useCallback(() => {
		if (flow.commit.phase === "writing") {
			return;
		}
		importDraftStore.dispatch({ type: "commitStarted" });
		const entries = plan.entries.filter(
			(_, index) => !flow.excluded.has(index),
		);
		applyImport(db, { ...plan, entries })
			.then((count) => {
				haptics("success");
				importDraftStore.clear();
				router.back();
				Alert.alert(
					t("import.reviewCommitSuccessTitle"),
					t("import.reviewCommitSuccessBody", { count }),
				);
			})
			.catch((error: unknown) => {
				importDraftStore.dispatch({
					type: "commitFailed",
					detail: error instanceof Error ? error.message : null,
				});
			});
	}, [db, plan, flow.excluded, flow.commit.phase, haptics, router, t]);

	return {
		plan,
		rows,
		excluded: flow.excluded,
		selectedCount,
		categoryName,
		commit: flow.commit,
		onToggle,
		onCommit,
	};
}
