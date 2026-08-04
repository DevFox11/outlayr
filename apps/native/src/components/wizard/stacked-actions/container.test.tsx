import { act, fireEvent, render } from "@testing-library/react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import { StackedActions } from "./container";
import { itemFrame } from "./geometry";
import { StackedActionsItem } from "./item";

const GAP = 8;

describe("StackedActions — onLayout-driven geometry", () => {
	it("drives item style from onLayout, matching the geometry oracle", async () => {
		const { getByTestId } = await render(
			<StackedActions>
				<StackedActionsItem label="Back" onPress={jest.fn()} testID="item-1" />
				<StackedActionsItem
					label="Continue"
					onPress={jest.fn()}
					testID="item-2"
				/>
			</StackedActions>,
		);

		await act(() => {
			fireEvent(getByTestId("strip-container"), "layout", {
				nativeEvent: { layout: { width: 328, height: 56, x: 0, y: 0 } },
			});
		});

		const geometry = { containerWidth: 328, count: 2, gap: GAP };
		const expected = itemFrame(geometry, 1, 0);
		const style = getAnimatedStyle(getByTestId("item-1"));
		expect(style.width).toBe(expected.width);
		expect(style.opacity).toBe(expected.opacity);
	});

	it("throws in __DEV__ when more than 3 items are declared", async () => {
		await expect(
			render(
				<StackedActions>
					<StackedActionsItem label="1" onPress={jest.fn()} />
					<StackedActionsItem label="2" onPress={jest.fn()} />
					<StackedActionsItem label="3" onPress={jest.fn()} />
					<StackedActionsItem label="4" onPress={jest.fn()} />
				</StackedActions>,
			),
		).rejects.toThrow();
	});
});
