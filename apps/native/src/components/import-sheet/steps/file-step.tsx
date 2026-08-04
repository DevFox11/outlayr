import { HugeiconsIcon } from "@hugeicons/react-native";
import { File01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "@/components/text";
import { useImportFlow } from "@/contexts/import-flow-context";
import {
	guessMapping,
	type ParsedImportFile,
	parseImportFile,
} from "@/data/transfer-core";
import {
	classifyParseFailure,
	HARD_PARSE_REJECT_CHARS,
} from "@/domain/import-diagnosis";
import { resolveImportMapping } from "@/domain/import-mapping";
import {
	deduceDateFormat,
	detectDecimalSeparator,
} from "@/domain/transaction-csv";
import { type TranslationKey, useTranslation } from "@/i18n";
import { pickCsvFile, TransferError } from "@/lib/data-transfer";
import { useColors } from "@/theme/use-colors";

type FileStepError =
	| { cause: "io"; key: TranslationKey }
	| { cause: "tooLarge" }
	| { cause: "empty" }
	| { cause: "noDataRows" }
	| { cause: "tooFewColumns" };

const ERROR_TITLE: Record<FileStepError["cause"], TranslationKey> = {
	io: "import.errorIoTitle",
	tooLarge: "import.errorTooLargeTitle",
	empty: "import.errorEmptyTitle",
	noDataRows: "import.errorNoDataTitle",
	tooFewColumns: "import.errorTooFewColumnsTitle",
};

const ERROR_BODY: Partial<Record<FileStepError["cause"], TranslationKey>> = {
	tooLarge: "import.errorTooLargeBody",
	empty: "import.errorEmptyBody",
	noDataRows: "import.errorNoDataBody",
	tooFewColumns: "import.errorTooFewColumnsBody",
};

const MAPPING_GAP_COPY: Record<string, TranslationKey> = {
	noLabelColumn: "import.mappingGapNoLabel",
	noDate: "import.mappingGapNoDate",
	noAmount: "import.mappingGapNoAmount",
};

export function FileStep() {
	const t = useTranslation();
	const colors = useColors();
	const router = useRouter();
	const { state, dispatch } = useImportFlow();
	const [status, setStatus] = useState<"idle" | "loading">("idle");
	const [error, setError] = useState<FileStepError | null>(null);

	const formatNote = useMemo(() => {
		if (state.parsed == null || state.resolved == null) {
			return null;
		}
		const { mapping } = state.resolved;
		const dateColumn = state.parsed.rows.map((row) => row[mapping.date] ?? "");
		const amountColumn = state.parsed.rows.map(
			(row) => row[mapping.amount] ?? "",
		);
		const format = deduceDateFormat(dateColumn);
		if (format == null) {
			return null;
		}
		const decimal = detectDecimalSeparator(amountColumn);
		return t("import.fileFormatNote", {
			format,
			decimal: t(
				decimal === "," ? "import.decimalComma" : "import.decimalPoint",
			),
		});
	}, [state.parsed, state.resolved, t]);

	const handleChoose = async () => {
		setStatus("loading");
		setError(null);
		try {
			const picked = await pickCsvFile();
			if (picked == null) {
				setStatus("idle");
				return;
			}
			if (picked.text.length > HARD_PARSE_REJECT_CHARS) {
				setStatus("idle");
				setError({ cause: "tooLarge" });
				return;
			}
			const parsed: ParsedImportFile | null = parseImportFile(picked.text);
			if (parsed == null) {
				setStatus("idle");
				setError({ cause: classifyParseFailure(picked.text) });
				return;
			}
			const draft =
				parsed.header == null
					? {
							category: null,
							note: null,
							date: null,
							amount: null,
							currency: null,
							type: null,
						}
					: guessMapping(parsed.header);
			const resolution = resolveImportMapping(draft);
			dispatch({
				type: "fileParsed",
				file: { name: picked.name, chars: picked.text.length },
				parsed,
				draft,
				resolved: resolution.ok ? resolution.value : null,
				gaps: resolution.ok ? [] : resolution.gaps,
			});
			setStatus("idle");
		} catch (thrown) {
			setStatus("idle");
			setError(
				thrown instanceof TransferError
					? { cause: "io", key: thrown.key }
					: { cause: "io", key: "alerts.transfer.unreadableFile" },
			);
		}
	};

	if (error == null && state.parsed != null && state.mappingGaps.length > 0) {
		return (
			<View className="items-center gap-4 pt-6">
				<View className="w-full gap-2 rounded-xl border border-border p-4">
					<Text className="font-sans-medium text-body text-danger">
						{t("import.mappingGapTitle")}
					</Text>
					{state.mappingGaps.map((gap) => (
						<Text className="text-footnote text-muted" key={gap}>
							{t(MAPPING_GAP_COPY[gap])}
						</Text>
					))}
				</View>
				<Pressable
					accessibilityRole="button"
					className="items-center active:opacity-60"
					onPress={() => {
						router.push("/settings/import");
						router.dismissAll();
					}}
				>
					<Text className="font-sans-medium text-body text-foreground underline">
						{t("import.mapManually")}
					</Text>
				</Pressable>
			</View>
		);
	}

	if (error != null) {
		return (
			<View className="items-center gap-4 pt-6">
				<View className="w-full gap-2 rounded-xl border border-border p-4">
					<Text className="font-sans-medium text-body text-danger">
						{t(ERROR_TITLE[error.cause])}
					</Text>
					<Text className="text-footnote text-muted">
						{error.cause === "io"
							? t(error.key)
							: t(ERROR_BODY[error.cause] as TranslationKey)}
					</Text>
				</View>
				<Pressable
					accessibilityRole="button"
					className="h-12 items-center justify-center rounded-3xl border border-border px-6 active:opacity-60"
					onPress={handleChoose}
				>
					<Text className="font-sans-medium text-callout text-foreground">
						{t("import.chooseCsv")}
					</Text>
				</Pressable>
			</View>
		);
	}

	if (state.parsed != null && state.resolved != null) {
		return (
			<View className="gap-3 pt-6">
				<View className="gap-3 rounded-xl p-4">
					<Text className="text-body text-foreground" numberOfLines={1}>
						{state.file?.name}
					</Text>
					<View className="flex-row gap-6">
						<View>
							<Text className="text-footnote text-muted">
								{t("import.fileRowsLabel")}
							</Text>
							<Text className="font-sans-semibold text-foreground text-hero tabular-nums">
								{state.parsed.rows.length}
							</Text>
						</View>
						<View>
							<Text className="text-footnote text-muted">
								{t("import.fileColumnsLabel")}
							</Text>
							<Text className="font-sans-semibold text-foreground text-hero tabular-nums">
								{state.parsed.width}
							</Text>
						</View>
					</View>
					{formatNote == null ? null : (
						<Text className="text-footnote text-muted">{formatNote}</Text>
					)}
					{state.resolved.labelSource === "descriptionColumn" ? (
						<Text className="text-footnote text-muted">
							{t("import.fileNoCategoryColumn")}
						</Text>
					) : null}
				</View>
				<Pressable
					accessibilityRole="button"
					className="items-start active:opacity-60"
					onPress={handleChoose}
				>
					<Text className="font-sans-medium text-body text-foreground underline">
						{t("import.chooseDifferentFile")}
					</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View className="items-center gap-3 pt-10">
			<View className="h-[140px] w-full items-center justify-center rounded-2xl border border-border border-dashed">
				<HugeiconsIcon color={colors.subtle} icon={File01Icon} size={32} />
				<Text className="pt-2 text-muted text-subtitle">
					{t("import.fileEmptyCaption")}
				</Text>
				<Pressable
					accessibilityRole="button"
					className="mt-4 h-12 min-w-[140px] items-center justify-center rounded-3xl border border-border px-6 active:opacity-60"
					onPress={handleChoose}
				>
					{status === "loading" ? (
						<ActivityIndicator color={colors.foreground} />
					) : (
						<Text className="font-sans-medium text-callout text-foreground">
							{t("import.chooseCsv")}
						</Text>
					)}
				</Pressable>
			</View>
			<Text className="text-footnote text-subtle">
				{t("import.fileOnDeviceNote")}
			</Text>
		</View>
	);
}
