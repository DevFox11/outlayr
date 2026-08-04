import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowRight01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { useRouter } from "expo-router";
import { Fragment } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useImportFlow } from "@/contexts/import-flow-context";
import { IMPORT_SOURCES } from "@/domain/import-sources";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

export function SourceStep() {
	const t = useTranslation();
	const colors = useColors();
	const router = useRouter();
	const { dispatch } = useImportFlow();

	return (
		<View className="gap-4 pt-4">
			<Text className="text-muted text-subtitle leading-snug">
				{t("import.sourceLede")}
			</Text>
			<View className="overflow-hidden rounded-xl">
				{IMPORT_SOURCES.map((source) => (
					<Fragment key={source.id}>
						<Pressable
							accessibilityRole="button"
							accessibilityState={{ disabled: !source.available }}
							className={cn(
								"flex-row items-center gap-3 px-3.5 py-[11px]",
								source.available ? undefined : "opacity-40",
							)}
							disabled={!source.available}
							onPress={() => {
								dispatch({ type: "sourceSelected", sourceId: source.id });
								router.push(source.entryRoute);
							}}
						>
							<View className="size-7 items-center justify-center rounded-lg">
								<HugeiconsIcon
									color={colors.foreground}
									icon={source.icon}
									size={15}
									strokeWidth={1.9}
								/>
							</View>
							<View className="flex-1">
								<Text className="font-sans-medium text-callout text-foreground">
									{t(source.titleKey)}
								</Text>
								<Text className="text-footnote text-muted" numberOfLines={1}>
									{source.available
										? t(source.subtitleKey)
										: t("import.sourceComingSoon")}
								</Text>
							</View>
							{source.available ? (
								<HugeiconsIcon
									color={colors.muted}
									icon={ArrowRight01Icon}
									size={16}
									strokeWidth={2}
								/>
							) : null}
						</Pressable>
					</Fragment>
				))}
			</View>
			<Pressable
				accessibilityRole="button"
				className="items-start active:opacity-60"
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
