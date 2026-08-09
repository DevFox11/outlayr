import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { IdentityHero } from "@/components/identity-hero";
import { HEADER_HEIGHT, HERO_BOTTOM_PADDING, HERO_TOP_PADDING } from "./style";

interface CategoryEditorHeroBandProps {
	captionClearance: number;
	color: string;
	emoji: string | null;
	floatProgress: SharedValue<number>;
	icon: string | null;
	income: boolean;
	onLayout: (event: LayoutChangeEvent) => void;
	onPress: () => void;
	onReset: () => void;
}

/**
 * `IdentityHero` imports `react-native-reanimated`, which crashes jest at
 * module-load time (see `src/domain/curtain-hues.ts`) — the same reason the
 * whole editor can't render there. This component inherits that gap rather
 * than introducing it; Maestro (`category-editor.yaml`) is its only coverage.
 */
export function CategoryEditorHeroBand({
	captionClearance,
	color,
	emoji,
	floatProgress,
	icon,
	income,
	onLayout,
	onPress,
	onReset,
}: CategoryEditorHeroBandProps) {
	return (
		<View
			onLayout={onLayout}
			pointerEvents="box-none"
			style={{
				alignItems: "center",
				left: 0,
				paddingBottom: HERO_BOTTOM_PADDING + captionClearance,
				paddingTop: HEADER_HEIGHT + HERO_TOP_PADDING,
				position: "absolute",
				right: 0,
				top: 0,
			}}
		>
			<IdentityHero
				color={color}
				emoji={emoji}
				floatProgress={floatProgress}
				icon={icon}
				income={income}
				onPress={onPress}
				onReset={onReset}
				photoUri={null}
				variant="category"
			/>
		</View>
	);
}
