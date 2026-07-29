import MenuView, { type MenuAction } from "@expo/ui/community/menu";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
	ArrowDown01Icon,
	Cancel01Icon,
} from "@hugeicons-pro/core-solid-rounded";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useColors } from "@/theme/use-colors";
import { Text } from "./text";

interface ScopeChipProps {
	title: string;
	/** Menu the title opens. Omit for a chip that only reports and dismisses. */
	actions?: MenuAction[];
	onAction?: (id: string) => void;
	/** Omit where the scope cannot be cleared, e.g. the window always has a value. */
	onClear?: () => void;
	menuTitle?: string;
	accessibilityLabel?: string;
	clearAccessibilityLabel?: string;
}

export function ScopeChip({
	title,
	actions,
	onAction,
	onClear,
	menuTitle,
	accessibilityLabel,
	clearAccessibilityLabel = "Clear",
}: ScopeChipProps) {
	const colors = useColors();
	const [labelWidth, setLabelWidth] = useState(0);
	const hasMenu = actions != null && actions.length > 0 && onAction != null;

	const label = (
		<View className="flex-row items-center gap-1.25">
			<Text
				className="font-sans-semibold text-foreground text-subtitle"
				numberOfLines={1}
			>
				{title}
			</Text>
			{hasMenu ? (
				<HugeiconsIcon color={colors.muted} icon={ArrowDown01Icon} size={10} />
			) : null}
		</View>
	);

	return (
		// `shrink-0` so a chip alone on a wrapping row keeps its natural width.
		<View
			accessibilityLabel={accessibilityLabel}
			className="shrink-0 flex-row items-center gap-2.25 rounded-full bg-surface-secondary px-3 py-1.5"
		>
			{/* On iOS `MenuView` is a `Host matchContents` around an `RNHostView
			    matchContents`, and that intrinsic width arrives from the native side
			    a frame late — the chip keeps a width fitted to nothing and truncates
			    "26 Jul - 1 Aug" to "26 Ju...". So the label is measured out here by
			    RN, off-layout and invisible, and the Host is handed the answer.
			    The label cannot simply live outside the menu: a SwiftUI `Menu` whose
			    label is an empty view has nothing to tap, and the menu stops opening. */}
			{hasMenu ? (
				<>
					<View
						onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
						pointerEvents="none"
						style={{ position: "absolute", opacity: 0, left: 0, top: 0 }}
					>
						{label}
					</View>
					<MenuView
						actions={actions}
						onPressAction={({ nativeEvent }) => onAction(nativeEvent.event)}
						shouldOpenOnLongPress={false}
						style={labelWidth > 0 ? { width: labelWidth } : undefined}
						title={menuTitle}
					>
						{label}
					</MenuView>
				</>
			) : (
				label
			)}
			{onClear ? (
				<Pressable
					accessibilityLabel={clearAccessibilityLabel}
					accessibilityRole="button"
					className="py-1 active:opacity-60"
					hitSlop={12}
					onPress={onClear}
				>
					<HugeiconsIcon color={colors.muted} icon={Cancel01Icon} size={11} />
				</Pressable>
			) : null}
		</View>
	);
}
