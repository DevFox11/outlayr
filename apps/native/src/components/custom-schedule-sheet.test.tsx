import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { render } from "@testing-library/react-native";
import { createRef } from "react";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { CustomScheduleSheet } from "./custom-schedule-sheet";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

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
});
