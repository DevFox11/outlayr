import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { MeasureStrip } from "./measure-strip";

describe("MeasureStrip", () => {
	it("renders every cell's label and string value", async () => {
		const { getByText } = await render(
			<MeasureStrip
				cells={[
					{ key: "rows", label: "Rows", value: "17" },
					{ key: "columns", label: "Columns", value: "4" },
					{ key: "dates", label: "Dates", value: "dd-MM-yyyy" },
				]}
			/>
		);
		expect(getByText("Rows")).toBeTruthy();
		expect(getByText("17")).toBeTruthy();
		expect(getByText("Columns")).toBeTruthy();
		expect(getByText("4")).toBeTruthy();
		expect(getByText("dd-MM-yyyy")).toBeTruthy();
	});

	it("renders a node value as-is", async () => {
		const { getByText } = await render(
			<MeasureStrip cells={[{ key: "out", label: "Out", value: <Text>-$348.40</Text> }]} />
		);
		expect(getByText("-$348.40")).toBeTruthy();
	});
});
