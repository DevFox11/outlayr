import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { render } from "@testing-library/react-native";
import { createRef } from "react";
import { TagPickerSheet } from "./tag-picker-sheet";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

describe("TagPickerSheet", () => {
	it("lands ref on the BottomSheetModal", async () => {
		const ref = createRef<BottomSheetModal>();
		await render(
			<TagPickerSheet
				onCreate={async () => null}
				onToggle={() => {}}
				ref={ref}
				selected={[]}
				tags={[]}
			/>,
		);
		expect(ref.current).toBeTruthy();
	});
});
