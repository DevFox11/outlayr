import { act, fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import { StackedActions } from "./container";
import { StackedActionsItem } from "./item";

async function renderStrip(overrides?: {
	onPressBack?: () => void;
	onPressConfirm?: () => void;
}) {
	return await render(
		<StackedActions>
			<StackedActionsItem
				label="Back"
				onPress={overrides?.onPressBack ?? jest.fn()}
				testID="strip-back"
			/>
			<StackedActionsItem
				confirmLabel="Import 3 transactions?"
				label="Import 3"
				onPress={overrides?.onPressConfirm ?? jest.fn()}
				testID="strip-confirm"
			/>
		</StackedActions>,
	);
}

describe("StackedActionsItem — pointerEvents and accessibility gating", () => {
	it("every item is interactive while the strip is collapsed", async () => {
		const { getByTestId } = await renderStrip();
		const back = getByTestId("strip-back");
		const confirm = getByTestId("strip-confirm");
		expect(back.props.pointerEvents).toBe("auto");
		expect(confirm.props.pointerEvents).toBe("auto");
	});

	it("expanding one item fades and gates its siblings (§10.2)", async () => {
		const { getByTestId } = await renderStrip();
		await act(() => {
			fireEvent.press(getByTestId("strip-confirm"));
		});
		// `accessibilityElementsHidden`/`importantForAccessibility` remove the
		// element from RNTL's default query tree too — the same signal a
		// screen reader would honor — so the faded item needs `includeHiddenElements`.
		const back = getByTestId("strip-back", { includeHiddenElements: true });
		expect(back.props.pointerEvents).toBe("none");
		expect(back.props.accessibilityElementsHidden).toBe(true);
		expect(back.props.importantForAccessibility).toBe("no-hide-descendants");

		const confirm = getByTestId("strip-confirm");
		expect(confirm.props.pointerEvents).toBe("auto");
	});

	it("dims a disabled item so it does not read as tappable", async () => {
		const { getByTestId } = await render(
			<StackedActions>
				<StackedActionsItem
					disabled
					label="Import 0"
					onPress={jest.fn()}
					testID="strip-disabled"
				/>
			</StackedActions>,
		);
		const item = getByTestId("strip-disabled", { includeHiddenElements: true });
		expect(item.props.pointerEvents).toBe("none");
		expect(getAnimatedStyle(item).opacity).toBe(0.4);
	});

	it("leaves an enabled item at full opacity", async () => {
		const { getByTestId } = await renderStrip();
		expect(getAnimatedStyle(getByTestId("strip-back")).opacity).toBe(1);
	});

	it("a faded item's press does not fire onPress (corroboration only — U6 unverified)", async () => {
		const onPressBack = jest.fn();
		const { getByTestId } = await renderStrip({ onPressBack });
		await act(() => {
			fireEvent.press(getByTestId("strip-confirm"));
		});
		fireEvent.press(getByTestId("strip-back", { includeHiddenElements: true }));
		expect(onPressBack).not.toHaveBeenCalled();
	});

	it("carries accessibilityRole, label, state and a confirm hint", async () => {
		const { getByTestId } = await renderStrip();
		const back = getByTestId("strip-back");
		expect(back.props.accessibilityRole).toBe("button");
		expect(back.props.accessibilityLabel).toBe("Back");
		expect(back.props.accessibilityState).toMatchObject({
			disabled: false,
			busy: false,
		});

		const confirm = getByTestId("strip-confirm");
		expect(confirm.props.accessibilityLabel).toBe("Import 3");
		await act(() => {
			fireEvent.press(confirm);
		});
		expect(getByTestId("strip-confirm").props.accessibilityLabel).toBe(
			"Import 3 transactions?",
		);
		expect(getByTestId("strip-confirm").props.accessibilityHint).toBe(
			"Double tap to confirm",
		);
	});

	it("first press on a confirm item expands and announces; onPress fires only on the second", async () => {
		const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
		const onPress = jest.fn();
		const { getByTestId } = await renderStrip({ onPressConfirm: onPress });
		const confirm = getByTestId("strip-confirm");

		await act(() => {
			fireEvent.press(confirm);
		});
		expect(onPress).not.toHaveBeenCalled();
		expect(announce).toHaveBeenCalledWith("Import 3 transactions?");

		await act(() => {
			fireEvent.press(getByTestId("strip-confirm"));
		});
		expect(onPress).toHaveBeenCalledTimes(1);
		announce.mockRestore();
	});

	it("a plain item (no confirmLabel) fires onPress on the first press", async () => {
		const onPress = jest.fn();
		const { getByTestId } = await renderStrip({ onPressBack: onPress });
		await act(() => {
			fireEvent.press(getByTestId("strip-back"));
		});
		expect(onPress).toHaveBeenCalledTimes(1);
	});
});
