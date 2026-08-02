import { render } from "@testing-library/react-native";
import type { ThemeColors } from "@/theme/use-colors";
import { Eyebrow } from "./category-list-chrome";

const colors = { muted: "#666666" } as ThemeColors;

describe("Eyebrow", () => {
	it("renders through @expo/ui/swift-ui's Text with its label and modifiers", async () => {
		const { toJSON } = await render(
			<Eyebrow colors={colors}>THIS MONTH</Eyebrow>,
		);

		const tree = toJSON();
		expect(tree?.type).toBe("ViewManagerAdapter_ExpoUI");
		expect(tree?.props.text).toBe("THIS MONTH");
		expect(tree?.props.modifiers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ $type: "textCase", value: "uppercase" }),
				expect.objectContaining({
					$type: "foregroundStyle",
					styleType: "color",
					color: "#666666",
				}),
			]),
		);
	});
});
