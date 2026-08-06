import { render } from "@testing-library/react-native";
import { EyebrowRow } from "./eyebrow-row";

describe("EyebrowRow", () => {
	it("renders the label", async () => {
		const { getByText } = await render(<EyebrowRow label="Bring data in" />);
		expect(getByText("Bring data in")).toBeTruthy();
	});

	it("renders the right-aligned value when given", async () => {
		const { getByText } = await render(
			<EyebrowRow label="bank.csv" value="17 rows" />,
		);
		expect(getByText("17 rows")).toBeTruthy();
	});

	it("omits the value slot when none is given", async () => {
		const { queryByText, toJSON } = await render(
			<EyebrowRow label="Bring data in" />,
		);
		expect(queryByText("17 rows")).toBeNull();
		expect(toJSON()).toBeTruthy();
	});
});
