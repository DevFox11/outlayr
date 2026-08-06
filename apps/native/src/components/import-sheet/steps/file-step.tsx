import { HugeiconsIcon } from "@hugeicons/react-native";
import { File02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { Button } from "panelui-native";
import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/text";
import { deduceDateFormat } from "@/domain/transaction-csv";
import { type TranslationKey, useTranslation } from "@/i18n";
import {
	type FileStepError,
	importDraftStore,
	useImportDraft,
} from "@/lib/import-draft-store";
import { useColors } from "@/theme/use-colors";
import { MeasureStrip } from "../measure-strip";
import { StepCta } from "../step-cta";

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

const DOC_TILE_SIZE = 30;

interface FileStepProps {
	onChoose: () => void;
	busy?: boolean;
}

function ChooseDifferentFile({ onChoose }: { onChoose: () => void }) {
	const t = useTranslation();
	return (
		<Button
			onPress={onChoose}
			variant="secondary"
			fullWidth
			className="rounded-full"
		>
			{t("import.chooseDifferentFile")}
		</Button>
	);
}

export function FileStep({ onChoose, busy = false }: FileStepProps) {
	const t = useTranslation();
	const colors = useColors();
	const { flow: state, ui } = useImportDraft();
	const error = ui.fileError;

	const dateFormat = useMemo(() => {
		if (state.parsed == null || state.resolved == null) {
			return null;
		}
		const { mapping } = state.resolved;
		return deduceDateFormat(
			state.parsed.rows.map((row) => row[mapping.date] ?? ""),
		);
	}, [state.parsed, state.resolved]);

	if (error == null && state.parsed != null && state.mappingGaps.length > 0) {
		return (
			<View className="flex-1 gap-4 px-5 pt-4">
				<View className="gap-2 border-border border-y py-3">
					<Text className="font-sans-medium text-body text-danger">
						{t("import.mappingGapTitle")}
					</Text>
					{state.mappingGaps.map((gap) => (
						<Text className="text-footnote text-muted" key={gap}>
							{t(MAPPING_GAP_COPY[gap])}
						</Text>
					))}
					<Text className="text-footnote text-muted">
						{t("import.mappingGapGuidance")}
					</Text>
				</View>
				<ChooseDifferentFile onChoose={onChoose} />
			</View>
		);
	}

	if (error != null) {
		return (
			<View className="flex-1 gap-4 px-5 pt-4">
				<View className="gap-2 border-border border-y py-3">
					<Text className="font-sans-medium text-body text-danger">
						{t(ERROR_TITLE[error.cause])}
					</Text>
					<Text className="text-footnote text-muted">
						{error.cause === "io"
							? t(error.key)
							: t(ERROR_BODY[error.cause] as TranslationKey)}
					</Text>
				</View>
				<StepCta
					busy={busy}
					className="mt-6"
					label={t("import.chooseCsv")}
					onPress={onChoose}
				/>
			</View>
		);
	}

	if (state.parsed != null && state.resolved != null) {
		return (
			<View className="flex-1 gap-4 px-5">
				<View className="flex-row items-center gap-3 py-3">
					<View className="size-7.5 items-center justify-center">
						<HugeiconsIcon
							color={colors.foreground}
							icon={File02Icon}
							size={20}
							strokeWidth={1.9}
						/>
					</View>
					<View className="flex-1 gap-0.5">
						<Text
							className="font-sans-medium text-body text-foreground"
							numberOfLines={1}
						>
							{state.file?.name}
						</Text>
						<Text className="text-muted text-subtitle" numberOfLines={1}>
							{t("import.fileReadOnDevice")}
						</Text>
					</View>
				</View>

				<MeasureStrip
					cells={[
						{
							key: "rows",
							label: t("import.fileRowsLabel"),
							value: String(state.parsed.rows.length),
						},
						{
							key: "columns",
							label: t("import.fileColumnsLabel"),
							value: String(state.parsed.width),
						},
						{
							key: "dates",
							label: t("import.fileDatesLabel"),
							value: dateFormat ?? "—",
						},
					]}
				/>

				{state.resolved.labelSource === "descriptionColumn" ? (
					<Text className="text-footnote text-muted leading-snug">
						{t("import.fileNoCategoryColumn")}
					</Text>
				) : null}

				<View className="gap-2">
					<ChooseDifferentFile onChoose={onChoose} />
					<StepCta
						busy={busy}
						label={t("common.continue")}
						onPress={() => importDraftStore.setStep("resolve")}
						testID="import-file-continue"
					/>
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 gap-4 px-5" testID="import-file-empty">
			<View className="flex-row items-center gap-3 py-3">
				<View
					className="items-center justify-center"
					style={{ width: DOC_TILE_SIZE, height: DOC_TILE_SIZE }}
				>
					<HugeiconsIcon
						color={colors.subtle}
						icon={File02Icon}
						size={20}
						strokeWidth={1.9}
					/>
				</View>
				<View className="flex-1 gap-0.5">
					<Text
						className="font-sans-medium text-body text-muted"
						numberOfLines={1}
					>
						{t("import.fileEmptyCaption")}
					</Text>
					<Text className="text-muted text-subtitle" numberOfLines={1}>
						{t("import.fileOnDeviceNote")}
					</Text>
				</View>
			</View>

			<MeasureStrip
				cells={[
					{ key: "rows", label: t("import.fileRowsLabel"), value: "—" },
					{ key: "columns", label: t("import.fileColumnsLabel"), value: "—" },
					{ key: "dates", label: t("import.fileDatesLabel"), value: "—" },
				]}
			/>

			<StepCta busy={busy} label={t("import.chooseCsv")} onPress={onChoose} />
		</View>
	);
}
