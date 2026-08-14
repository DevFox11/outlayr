import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { MeasureStrip } from "./measure-strip";

describe("measureStrip", () => {
    it("renders every cell's label and string value", async () => {
        const { getByText } = await render(
            <MeasureStrip
                cells={[
                    { figure: "17", key: "rows", label: "Rows" },
                    { figure: "4", key: "columns", label: "Columns" },
                    { figure: "dd-MM-yyyy", key: "dates", label: "Dates" },
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
