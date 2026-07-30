import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	TextInput,
	View,
} from "react-native";
import {
	CategoryPickerSheet,
	type CategoryPickerSheetRef,
} from "@/components/category-picker-sheet";
import { MonoLabel } from "@/components/mono-label";
import { SegmentedControl } from "@/components/segmented-control";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDatabase } from "@/contexts/local-data-context";
import { useCategoriesByNamespace } from "@/data/categories";
import {
	applyImport,
	buildImportPlan,
	type ColumnMapping,
	categoryKey,
	guessMapping,
	type ImportPlan,
	type ParsedImportFile,
	parseImportFile,
	uniqueCategoryValues,
} from "@/data/transfer-core";
import type { Database } from "@/db/client";
import {
	type DecimalSeparator,
	deduceDateFormat,
	detectDecimalSeparator,
	parseCsvDate,
} from "@/domain/transaction-csv";
import {
	type TranslateFn,
	type TranslationKey,
	translateNow,
	useTranslation,
} from "@/i18n";
import { pickCsvFile, TransferError } from "@/lib/data-transfer";
import { useColors } from "@/theme/use-colors";

type Step = "pick" | "map" | "format" | "link" | "review" | "running" | "done";

type Draft = Record<keyof ColumnMapping, number | null>;

const EMPTY_DRAFT: Draft = {
	category: null,
	note: null,
	date: null,
	amount: null,
	currency: null,
	type: null,
};

const SLOTS = [
	{ field: "date", label: "settings.import.slotDate", required: true },
	{ field: "amount", label: "settings.import.slotAmount", required: true },
	{ field: "category", label: "settings.import.slotCategory", required: true },
	{ field: "note", label: "settings.import.slotNote", required: false },
	{ field: "currency", label: "settings.import.slotCurrency", required: false },
	{ field: "type", label: "settings.import.slotType", required: false },
] as const satisfies readonly {
	field: keyof ColumnMapping;
	label: TranslationKey;
	required: boolean;
}[];

const SKIP_LABEL = {
	category: "settings.import.skippedCategory",
	date: "settings.import.skippedDate",
	amount: "settings.import.skippedAmount",
} as const satisfies Record<string, TranslationKey>;

function columnTitle(file: ParsedImportFile, index: number): string {
	const named = file.header?.[index]?.trim();
	return named == null || named === ""
		? translateNow("settings.import.columnNumber", { number: index + 1 })
		: named;
}

function skipReason(t: TranslateFn, reason: string): string {
	return t(SKIP_LABEL[reason as keyof typeof SKIP_LABEL]);
}

/** `toDateString` would print an English weekday and month whatever the language. */
function isoDay(date: Date): string {
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

function sampleOf(file: ParsedImportFile, index: number): string {
	return (
		file.rows.find((row) => (row[index] ?? "").trim() !== "")?.[index] ?? ""
	);
}

export default function ImportDataScreen() {
	const db = useDatabase();
	return <ImportData db={db} />;
}

function ImportData({ db }: { db: Database }) {
	const router = useRouter();
	const colors = useColors();
	const t = useTranslation();
	const pickerRef = useRef<CategoryPickerSheetRef>(null);
	const expenseTree = useCategoriesByNamespace(db, false);
	const incomeTree = useCategoriesByNamespace(db, true);

	const [step, setStep] = useState<Step>("pick");
	const [file, setFile] = useState<ParsedImportFile | null>(null);
	const [fileName, setFileName] = useState("");
	const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
	const [dateFormat, setDateFormat] = useState("");
	const [decimal, setDecimal] = useState<DecimalSeparator>(".");
	/**
	 * `date:amount` of the mapping the format step was last seeded from. Deducing
	 * again on every visit would overwrite a pattern the user typed by hand.
	 */
	const [seededFor, setSeededFor] = useState<string | null>(null);
	const [links, setLinks] = useState<ReadonlyMap<string, string>>(new Map());
	const [pending, setPending] = useState<{
		value: string;
		income: boolean;
	} | null>(null);
	const [plan, setPlan] = useState<ImportPlan | null>(null);
	/**
	 * Set once the write failed. `detail` is the driver's own untranslated text,
	 * shown under the translated sentence rather than as it — a raw SQLite message
	 * standing alone reads as gibberish and says nothing about the ledger's state.
	 */
	const [failure, setFailure] = useState<{ detail: string | null } | null>(
		null,
	);
	const [written, setWritten] = useState(0);

	const catalog = useMemo(() => {
		const income = new Map<string, boolean>();
		const name = new Map<string, string>();
		for (const [tree, flag] of [
			[expenseTree, false],
			[incomeTree, true],
		] as const) {
			for (const parent of tree) {
				for (const category of [parent, ...parent.children]) {
					income.set(category.id, flag);
					name.set(
						category.id,
						category.name ?? t("settings.import.untitledCategory"),
					);
				}
			}
		}
		return { income, name };
	}, [expenseTree, incomeTree, t]);

	const mapping = useMemo<ColumnMapping | null>(
		() =>
			draft.date == null || draft.amount == null || draft.category == null
				? null
				: {
						category: draft.category,
						note: draft.note,
						date: draft.date,
						amount: draft.amount,
						currency: draft.currency,
						type: draft.type,
					},
		[draft],
	);

	const values = useMemo(
		() =>
			file == null || mapping == null
				? []
				: uniqueCategoryValues(file.rows, mapping.category),
		[file, mapping],
	);

	const dateColumn = useMemo(
		() =>
			file == null || mapping == null
				? []
				: file.rows.map((row) => row[mapping.date] ?? ""),
		[file, mapping],
	);

	const readableDates = useMemo(
		() =>
			dateColumn.filter((value) => parseCsvDate(value, dateFormat) != null)
				.length,
		[dateColumn, dateFormat],
	);

	const linkedCount = values.filter((value) =>
		links.has(categoryKey(value)),
	).length;

	const choose = () => {
		pickCsvFile()
			.then((picked) => {
				if (picked == null) {
					return;
				}
				const parsed = parseImportFile(picked.text);
				if (parsed == null) {
					Alert.alert(
						t("settings.import.badFileTitle"),
						t("settings.import.badFileBody"),
					);
					return;
				}
				setFile(parsed);
				setFileName(picked.name);
				setDraft(
					parsed.header == null ? EMPTY_DRAFT : guessMapping(parsed.header),
				);
				setLinks(new Map());
				setPlan(null);
				setSeededFor(null);
				setStep("map");
			})
			.catch((error: unknown) => {
				Alert.alert(
					t("settings.import.failedTitle"),
					error instanceof TransferError
						? t(error.key)
						: t("settings.import.failedBody"),
				);
			});
	};

	const enterFormatStep = () => {
		if (file == null || mapping == null) {
			return;
		}
		const key = `${mapping.date}:${mapping.amount}`;
		if (key !== seededFor) {
			setDateFormat(deduceDateFormat(dateColumn) ?? "");
			setDecimal(
				detectDecimalSeparator(
					file.rows.map((row) => row[mapping.amount] ?? ""),
				),
			);
			setSeededFor(key);
		}
		setStep("format");
	};

	const enterReviewStep = () => {
		if (file == null || mapping == null) {
			return;
		}
		setPlan(
			buildImportPlan(
				file.rows,
				mapping,
				dateFormat,
				decimal,
				links,
				catalog.income,
			),
		);
		setStep("review");
	};

	const run = () => {
		if (plan == null) {
			return;
		}
		setStep("running");
		applyImport(db, plan)
			.then((count) => {
				setWritten(count);
				setFailure(null);
			})
			.catch((error: unknown) => {
				setFailure({ detail: error instanceof Error ? error.message : null });
			})
			.finally(() => setStep("done"));
	};

	const assign = (field: keyof ColumnMapping, index: number | null) => {
		setDraft((current) => {
			const next = { ...current };
			// One column feeds one field, as in Swift's `remainingColumns`: reusing it
			// silently duplicates a value into two meanings.
			for (const key of Object.keys(next) as (keyof ColumnMapping)[]) {
				if (next[key] === index) {
					next[key] = null;
				}
			}
			next[field] = index;
			return next;
		});
	};

	return (
		<>
			<ScrollView
				className="flex-1 bg-background"
				contentContainerClassName="px-5 pb-safe-offset-10"
				contentInsetAdjustmentBehavior="automatic"
			>
				{step === "pick" ? <PickStep onPick={choose} /> : null}

				{step === "map" && file != null ? (
					<View className="gap-1 pt-6">
						<MonoLabel>
							{t("settings.import.step1", { file: fileName })}
						</MonoLabel>
						<Text className="pb-2 text-muted text-subtitle leading-snug">
							{t("settings.import.mapIntro")}
						</Text>
						{SLOTS.map((slot) => (
							<SlotPicker
								assigned={draft[slot.field]}
								file={file}
								key={slot.field}
								label={t(slot.label)}
								onAssign={(index) => assign(slot.field, index)}
								required={slot.required}
							/>
						))}
					</View>
				) : null}

				{step === "format" && file != null ? (
					<View className="gap-1 pt-6">
						<MonoLabel>{t("settings.import.step2")}</MonoLabel>
						<Text className="pb-3 text-muted text-subtitle leading-snug">
							{t("settings.import.datesRead", {
								read: readableDates,
								total: dateColumn.length,
							})}
						</Text>
						<Text className="pb-1 text-muted text-subtitle">
							{t("settings.import.sample", {
								value: dateColumn.find((value) => value.trim() !== "") ?? "—",
							})}
						</Text>
						<TextInput
							autoCapitalize="none"
							autoCorrect={false}
							className="rounded-xl border border-border px-4 py-3 font-sans text-body text-foreground"
							onChangeText={setDateFormat}
							placeholder="yyyy-MM-dd"
							placeholderTextColor={colors.subtle}
							value={dateFormat}
						/>
						<Text className="pt-2 pb-6 text-subtitle text-subtle leading-snug">
							{t("settings.import.tokens")}
						</Text>

						<MonoLabel>{t("settings.import.decimalSeparator")}</MonoLabel>
						<View className="pt-2">
							<SegmentedControl
								onChange={setDecimal}
								options={[
									{ label: "1,234.56", value: "." },
									{ label: "1.234,56", value: "," },
								]}
								value={decimal}
							/>
						</View>
					</View>
				) : null}

				{step === "link" ? (
					<View className="gap-1 pt-6">
						<MonoLabel>{t("settings.import.step3")}</MonoLabel>
						<Text className="pb-2 text-muted text-subtitle leading-snug">
							{t("settings.import.linkIntro", {
								linked: linkedCount,
								total: values.length,
							})}
						</Text>
						{values.map((value) => {
							const linkedId = links.get(categoryKey(value));
							return (
								<LinkRowItem
									income={catalog.income.get(linkedId ?? "") ?? false}
									key={categoryKey(value)}
									linkedName={
										linkedId == null
											? null
											: (catalog.name.get(linkedId) ?? null)
									}
									onChoose={(income) => {
										setPending({ value, income });
										pickerRef.current?.present();
									}}
									value={value}
								/>
							);
						})}
					</View>
				) : null}

				{step === "review" && plan != null ? <ReviewStep plan={plan} /> : null}

				{step === "running" ? (
					<View className="items-center gap-3 pt-16">
						<ActivityIndicator color={colors.foreground} />
						<Text className="text-muted text-subtitle">
							{t("settings.import.writing")}
						</Text>
					</View>
				) : null}

				{step === "done" ? (
					<View className="gap-2 pt-16">
						<MonoLabel>
							{failure == null
								? t("settings.import.imported")
								: t("settings.import.failed")}
						</MonoLabel>
						<Text className="font-sans-semibold text-foreground text-hero tabular-nums">
							{failure == null ? written : "—"}
						</Text>
						<Text className="text-muted text-subtitle leading-snug">
							{failure != null
								? t("settings.import.writeFailed")
								: written === 1
									? t("settings.import.addedOne")
									: t("settings.import.addedMany")}
						</Text>
						{failure?.detail == null ? null : (
							<Text className="text-subtitle text-subtle leading-snug">
								{t("settings.import.writeFailedDetail", {
									detail: failure.detail,
								})}
							</Text>
						)}
					</View>
				) : null}
			</ScrollView>

			<Footer
				disabled={
					(step === "map" && mapping == null) ||
					(step === "format" && readableDates === 0) ||
					(step === "link" && linkedCount === 0) ||
					(step === "review" && (plan?.entries.length ?? 0) === 0)
				}
				label={
					step === "pick"
						? t("settings.import.chooseCsvFile")
						: step === "review"
							? t("settings.import.importCount", {
									total: plan?.entries.length ?? 0,
								})
							: step === "done"
								? t("common.done")
								: t("common.continue")
				}
				onPress={() => {
					if (step === "pick") {
						choose();
					} else if (step === "map") {
						enterFormatStep();
					} else if (step === "format") {
						setStep("link");
					} else if (step === "link") {
						enterReviewStep();
					} else if (step === "review") {
						run();
					} else if (step === "done") {
						router.back();
					}
				}}
				onBack={
					step === "map"
						? () => setStep("pick")
						: step === "format"
							? () => setStep("map")
							: step === "link"
								? () => setStep("format")
								: step === "review"
									? () => setStep("link")
									: undefined
				}
				visible={step !== "running"}
			/>

			<CategoryPickerSheet
				db={db}
				income={pending?.income ?? false}
				onSelect={(category) => {
					if (pending != null) {
						const key = categoryKey(pending.value);
						setLinks((current) => new Map(current).set(key, category.id));
					}
					pickerRef.current?.dismiss();
					setPending(null);
				}}
				ref={pickerRef}
				selectedId={
					pending == null
						? null
						: (links.get(categoryKey(pending.value)) ?? null)
				}
			/>
		</>
	);
}

function PickStep({ onPick }: { onPick: () => void }) {
	const t = useTranslation();
	return (
		<View className="gap-1 pt-6">
			<MonoLabel>{t("settings.import.beforeYouStart")}</MonoLabel>
			<Text className="pb-4 text-muted text-subtitle leading-snug">
				{t("settings.import.intro")}
			</Text>
			<Pressable
				accessibilityRole="button"
				className="items-start active:opacity-60"
				onPress={onPick}
			>
				<Text className="font-sans-medium text-body text-foreground underline">
					{t("settings.import.chooseAFile")}
				</Text>
			</Pressable>
		</View>
	);
}

function SlotPicker({
	label,
	required,
	file,
	assigned,
	onAssign,
}: {
	label: string;
	required: boolean;
	file: ParsedImportFile;
	assigned: number | null;
	onAssign: (index: number | null) => void;
}) {
	const t = useTranslation();
	return (
		<View className="border-border border-b py-3">
			<View className="flex-row items-baseline justify-between gap-2 pb-2">
				<Text className="font-sans-medium text-body text-foreground">
					{label}
				</Text>
				{required ? null : (
					<Pressable
						accessibilityRole="button"
						className="active:opacity-60"
						onPress={() => onAssign(null)}
					>
						<Text className="text-subtitle text-subtle">
							{t("common.skip")}
						</Text>
					</Pressable>
				)}
			</View>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View className="flex-row gap-2">
					{Array.from({ length: file.width }, (_, index) => index).map(
						(index) => (
							<Pressable
								accessibilityRole="button"
								className={cn(
									"rounded-lg border px-3 py-2 active:opacity-60",
									assigned === index
										? "border-foreground bg-foreground"
										: "border-border",
								)}
								key={index}
								onPress={() => onAssign(index)}
							>
								<Text
									className={cn(
										"font-sans-medium text-subtitle",
										assigned === index ? "text-background" : "text-foreground",
									)}
								>
									{columnTitle(file, index)}
								</Text>
								<Text
									className={cn(
										"text-subtitle",
										assigned === index ? "text-background" : "text-subtle",
									)}
									numberOfLines={1}
								>
									{sampleOf(file, index) || "—"}
								</Text>
							</Pressable>
						),
					)}
				</View>
			</ScrollView>
		</View>
	);
}

function LinkRowItem({
	value,
	linkedName,
	income,
	onChoose,
}: {
	value: string;
	linkedName: string | null;
	income: boolean;
	onChoose: (income: boolean) => void;
}) {
	const t = useTranslation();
	return (
		<View className="flex-row items-center gap-3 border-border border-b py-3">
			<Text className="flex-1 text-body text-foreground" numberOfLines={1}>
				{value}
			</Text>
			{linkedName == null ? (
				<View className="flex-row gap-2">
					<Pressable
						accessibilityRole="button"
						className="rounded-lg border border-border px-3 py-1.5 active:opacity-60"
						onPress={() => onChoose(false)}
					>
						<Text className="text-foreground text-subtitle">
							{t("common.expense")}
						</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						className="rounded-lg border border-border px-3 py-1.5 active:opacity-60"
						onPress={() => onChoose(true)}
					>
						<Text className="text-foreground text-subtitle">
							{t("common.income")}
						</Text>
					</Pressable>
				</View>
			) : (
				<Pressable
					accessibilityRole="button"
					className="active:opacity-60"
					onPress={() => onChoose(income)}
				>
					<Text className="font-sans-medium text-body text-foreground underline">
						{linkedName}
					</Text>
				</Pressable>
			)}
		</View>
	);
}

function ReviewStep({ plan }: { plan: ImportPlan }) {
	const t = useTranslation();
	const reasons = new Map<string, number>();
	for (const row of plan.skipped) {
		reasons.set(row.reason, (reasons.get(row.reason) ?? 0) + 1);
	}

	return (
		<View className="gap-1 pt-6">
			<MonoLabel>{t("settings.import.step4")}</MonoLabel>
			<Text className="font-sans-semibold text-foreground text-hero tabular-nums">
				{plan.entries.length}
			</Text>
			<Text className="pb-4 text-muted text-subtitle">
				{plan.entries.length === 1
					? t("settings.import.willAddOne")
					: t("settings.import.willAddMany")}
			</Text>

			{plan.earliest != null && plan.latest != null ? (
				<Text className="pb-4 text-muted text-subtitle">
					{t("settings.import.planRange", {
						from: isoDay(plan.earliest),
						to: isoDay(plan.latest),
					})}
				</Text>
			) : null}

			{plan.skipped.length === 0 ? (
				<Text className="text-muted text-subtitle leading-snug">
					{t("settings.import.allRowsRead")}
				</Text>
			) : (
				<View className="gap-1">
					<MonoLabel>
						{t("settings.import.skippedCount", { total: plan.skipped.length })}
					</MonoLabel>
					{[...reasons].map(([reason, count]) => (
						<Text className="text-muted text-subtitle" key={reason}>
							{`${count} · ${skipReason(t, reason)}`}
						</Text>
					))}
					<Text className="pt-1 text-subtitle text-subtle leading-snug">
						{t("settings.import.skippedNote")}
					</Text>
				</View>
			)}
		</View>
	);
}

function Footer({
	label,
	onPress,
	onBack,
	disabled,
	visible,
}: {
	label: string;
	onPress: () => void;
	/** Omitted on the first and last steps, which have nothing to step back to. */
	onBack?: () => void;
	disabled: boolean;
	visible: boolean;
}) {
	const t = useTranslation();
	if (!visible) {
		return null;
	}
	return (
		<View className="border-border border-t bg-background px-5 pt-3 pb-safe-offset-3">
			{onBack ? (
				<Pressable
					accessibilityRole="button"
					className="items-center pb-3 active:opacity-60"
					onPress={onBack}
				>
					<Text className="text-muted text-subtitle">
						{t("settings.import.back")}
					</Text>
				</Pressable>
			) : null}
			<Pressable
				accessibilityRole="button"
				className="h-14 items-center justify-center rounded-[28px] bg-foreground active:opacity-70"
				disabled={disabled}
				onPress={onPress}
				style={disabled ? { opacity: 0.4 } : undefined}
			>
				<Text className="font-sans-semibold text-background text-callout">
					{label}
				</Text>
			</Pressable>
		</View>
	);
}
