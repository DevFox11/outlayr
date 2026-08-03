import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { act, render } from "@testing-library/react-native";
import { createRef } from "react";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { CustomScheduleSheet } from "./custom-schedule-sheet";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

interface JsonNode {
	type: string;
	props: Record<string, unknown>;
	children: (JsonNode | string)[] | null;
}

function findByProp(
	node: JsonNode | JsonNode[] | null,
	key: string,
	value: unknown,
): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findByProp(child, key, value);
			if (found) {
				return found;
			}
		}
		return null;
	}
	if (node.props?.[key] === value) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const found = findByProp(child, key, value);
		if (found) {
			return found;
		}
	}
	return null;
}

describe("CustomScheduleSheet", () => {
	it("lands ref on the BottomSheetModal", async () => {
		const ref = createRef<BottomSheetModal>();
		await render(
			<CustomScheduleSheet
				onDone={() => {}}
				recurringCoefficient={2}
				recurringType={RECURRING_TYPE.monthly}
				ref={ref}
			/>,
		);
		expect(ref.current).toBeTruthy();
	});

	it("shows the seeded cadence on the first frame instead of the monthly/2 default", async () => {
		const ref = createRef<BottomSheetModal>();
		const { toJSON } = await render(
			<CustomScheduleSheet
				onDone={() => {}}
				recurringCoefficient={4}
				recurringType={RECURRING_TYPE.weekly}
				ref={ref}
			/>,
		);
		// Content only mounts once presented (@expo/ui/swift-ui's `BottomSheet`
		// unmounts children while `isPresented` is false), so the seeded-cadence
		// assertion below needs the sheet open to see the Picker/Stepper values.
		await act(async () => {
			ref.current?.present();
		});

		expect(findByProp(toJSON() as JsonNode, "value", 4)).not.toBeNull();
		expect(
			findByProp(toJSON() as JsonNode, "selection", RECURRING_TYPE.weekly),
		).not.toBeNull();
	});
});
