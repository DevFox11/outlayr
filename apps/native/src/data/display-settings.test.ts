import { selectDisplaySettings } from "./display-settings";
import type { BoolSettingKey, NumberSettingKey } from "./settings-core";

function snapshot(bools: Partial<Record<BoolSettingKey, boolean>>) {
	return {
		bool: (key: BoolSettingKey) => bools[key] ?? false,
		number: (_key: NumberSettingKey) => 0,
	};
}

describe("selectDisplaySettings", () => {
	it("maps each display field to its underlying setting key", () => {
		const result = selectDisplaySettings(
			snapshot({
				showCents: true,
				use24HourClock: true,
				swapTimeLabel: false,
			}),
		);
		expect(result).toStrictEqual({
			showCents: true,
			use24Hour: true,
			swapTimeLabel: false,
		});
	});

	it("defaults every field to false when nothing is set", () => {
		const result = selectDisplaySettings(snapshot({}));
		expect(result).toStrictEqual({
			showCents: false,
			use24Hour: false,
			swapTimeLabel: false,
		});
	});
});
