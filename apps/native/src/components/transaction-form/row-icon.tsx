import { RNHostView } from "@expo/ui/swift-ui";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { View } from "react-native";

export const ROW_ICON_SIZE = 19;

export function TransactionFormRowIcon({
	icon,
	color,
}: {
	icon: IconSvgElement;
	color: string;
}) {
	return (
		<RNHostView matchContents>
			<View style={{ width: ROW_ICON_SIZE, height: ROW_ICON_SIZE }}>
				<HugeiconsIcon
					color={color}
					icon={icon}
					size={ROW_ICON_SIZE}
					strokeWidth={1.8}
				/>
			</View>
		</RNHostView>
	);
}
