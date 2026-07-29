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

export function FloatingAddButton() {
	const accentColor = useCSSVariable("--color-accent");

	return (
		<View className="absolute right-5 bottom-safe-offset-17">
			<Host matchContents>
				<Menu
					label="Add"
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
						label="Create transaction"
						onPress={() => router.push("/transaction/new")}
					/>
				</Menu>
			</Host>
		</View>
	);
}
