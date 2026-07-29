import { foregroundStyle, tint } from "@expo/ui/swift-ui/modifiers";
import { PlatformColor } from "react-native";

export const secondaryText = foregroundStyle({
	type: "hierarchical",
	style: "secondary",
});

/** Neutral tint for menu-style pickers, in place of the accent colour. */
export const menuTint = tint(PlatformColor("secondaryLabel"));
