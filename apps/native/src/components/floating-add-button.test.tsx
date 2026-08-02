import { render } from "@testing-library/react-native";
import { FloatingAddButton } from "./floating-add-button";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

describe("FloatingAddButton spike", () => {
	it("renders through uniwind + expo-router + @expo/ui together", async () => {
		const { toJSON } = await render(<FloatingAddButton />);
		expect(toJSON()).toBeTruthy();
	});
});
