import {
	Children,
	isValidElement,
	type ReactElement,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { StripContext, StripPositionContext } from "./context";
import type { StackedActionsItemProps } from "./item";
import { SPRING_CONFIG } from "./spring";

const GAP = 8;
const MAX_ITEMS = 3;

export interface StackedActionsProps {
	children: ReactNode;
}

export function StackedActions({ children }: StackedActionsProps) {
	const items = Children.toArray(children).filter((child) =>
		isValidElement<StackedActionsItemProps>(child),
	) as ReactElement<StackedActionsItemProps>[];
	const count = items.length;

	if (__DEV__ && count > MAX_ITEMS) {
		throw new Error(
			`StackedActions: at most ${MAX_ITEMS} items are supported, got ${count} (reference defect §10.9).`,
		);
	}

	const [containerWidth, setContainerWidth] = useState(0);
	const [expandedIndex, setExpandedIndex] = useState(0);
	const expandedIndexShared = useSharedValue(0);
	const geometryShared = useSharedValue({ containerWidth, count, gap: GAP });

	useEffect(() => {
		geometryShared.value = { containerWidth, count, gap: GAP };
	}, [containerWidth, count, geometryShared]);

	function setExpanded(index1: number) {
		setExpandedIndex(index1);
		expandedIndexShared.value = withSpring(index1, SPRING_CONFIG);
	}

	function onLayout(event: LayoutChangeEvent) {
		setContainerWidth(event.nativeEvent.layout.width);
	}

	return (
		<StripContext.Provider
			value={{
				geometryShared,
				expandedIndex,
				expandedIndexShared,
				setExpanded,
			}}
		>
			<View
				className="h-14 flex-row"
				onLayout={onLayout}
				testID="strip-container"
			>
				{items.map((item, i) => (
					<StripPositionContext.Provider
						key={item.key ?? i}
						value={{ index1: i + 1 }}
					>
						{item}
					</StripPositionContext.Provider>
				))}
			</View>
		</StripContext.Provider>
	);
}
