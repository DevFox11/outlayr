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
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { useTranslation } from "@/i18n";

export function FloatingAddButton() {
	const accentColor = useCSSVariable("--color-accent");
	const t = useTranslation();

	return (
		<View className="absolute right-5 bottom-safe-offset-17">
			<Host matchContents>
				<Menu
					label={t("log.add.menu")}
					systemImage="plus"
					modifiers={[
						buttonStyle("glassProminent"),
						buttonBorderShape("circle"),
						tint(accentColor as string),
						labelStyle("iconOnly"),
						controlSize("extraLarge"),
					]}
				>
					<Button
						label={t("log.add.transaction")}
						onPress={() => router.push("/transaction/new")}
					/>
					<Button
						label={t("log.add.import")}
						onPress={() => router.push("/import")}
					/>
				</Menu>
			</Host>
		</View>
	);
}
