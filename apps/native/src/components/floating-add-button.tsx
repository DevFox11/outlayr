import { Button, Host } from "@expo/ui";
import { Menu } from "@expo/ui/swift-ui";
import {
	buttonBorderShape,
	buttonStyle,
	controlSize,
	labelStyle,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import {
	ImportSheet,
	type ImportSheetHandle,
} from "@/components/import-sheet/import-sheet";
import { useTranslation } from "@/i18n";
import { importDraftStore } from "@/lib/import-draft-store";

export function FloatingAddButton() {
	const accentColor = useCSSVariable("--color-primary") as string;
	const t = useTranslation();
	const importSheetRef = useRef<ImportSheetHandle>(null);

	return (
		<>
			<View className="absolute right-5 bottom-safe-offset-17">
				<Host matchContents>
					<Menu
						label={t("log.add.menu")}
						systemImage="plus"
						modifiers={[
							buttonStyle("glassProminent"),
							buttonBorderShape("circle"),
							tint(accentColor),
							labelStyle("iconOnly"),
							controlSize("extraLarge"),
						]}
					>
						<Button
							label={t("log.add.transaction")}
							onPress={() => router.push("/transactions/create")}
						/>
						<Button
							label={t("log.add.import")}
							onPress={() => {
								importDraftStore.setStep(importDraftStore.getResumeStep());
								importSheetRef.current?.present();
							}}
						/>
					</Menu>
				</Host>
			</View>
			<ImportSheet ref={importSheetRef} />
		</>
	);
}
