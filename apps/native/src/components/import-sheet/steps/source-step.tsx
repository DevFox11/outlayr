import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowRight01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { IMPORT_SOURCES } from "@/domain/import-sources";
import { useTranslation } from "@/i18n/context";
import { importDraftStore } from "@/lib/import-draft-store";
import { useColors } from "@/theme/use-colors";
import { EyebrowRow } from "../eyebrow-row";

const ICON_TILE_SIZE = 30;

export function SourceStep() {
	const t = useTranslation();
	const colors = useColors();
	const available = IMPORT_SOURCES.filter((source) => source.available).length;

	return (
		<View className="flex-1 px-5">
			<EyebrowRow
				label={t("import.sourceEyebrow")}
				value={t("import.sourceCount", {
					count: available,
					total: IMPORT_SOURCES.length,
				})}
			/>
			{IMPORT_SOURCES.map((source) => (
				<Pressable
					accessibilityRole="button"
					accessibilityState={source.available ? undefined : { disabled: true }}
					className={cn(
						"flex-row items-center gap-3 border-border border-b py-3",
						source.available ? "active:opacity-70" : "opacity-40"
					)}
					disabled={!source.available}
					key={source.id}
					onPress={() => {
						importDraftStore.dispatch({
							sourceId: source.id,
							type: "sourceSelected",
						});
						importDraftStore.setStep("file");
					}}
					testID={`import-source-${source.id}`}
				>
					<View className="items-center justify-center" style={{ height: ICON_TILE_SIZE, width: ICON_TILE_SIZE }}>
						<HugeiconsIcon color={colors.foreground} icon={source.icon} size={20} strokeWidth={1.9} />
					</View>
					<View className="flex-1 gap-0.5">
						<Text className="font-sans-medium text-callout text-foreground" numberOfLines={1}>
							{t(source.titleKey)}
						</Text>
						<Text className="text-muted text-subtitle" numberOfLines={1}>
							{source.available ? t(source.subtitleKey) : t("import.sourceComingSoon")}
						</Text>
					</View>
					{source.available ? (
						<HugeiconsIcon color={colors.muted} icon={ArrowRight01Icon} size={16} strokeWidth={2} />
					) : null}
				</Pressable>
			))}
			<Text className="pt-3 text-footnote text-muted leading-snug">{t("import.sourceLede")}</Text>
		</View>
	);
}
