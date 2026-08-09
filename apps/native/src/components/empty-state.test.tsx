import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { MarkInk, useMark } from "./empty-state";

jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({ foreground: "#000000" }),
}));

function Probe() {
	const ink = useMark();
	return <Text testID="probe">{ink.fill}</Text>;
}

describe("useMark", () => {
	it("resolves via use() outside a MarkInk provider", async () => {
		const { getByTestId } = await render(<Probe />);
		expect(getByTestId("probe").props.children).toBeTruthy();
	});

	it("resolves the provided tier's ink via use() inside a MarkInk provider", async () => {
		const { getByTestId: outside } = await render(<Probe />);
		const { getByTestId: inside } = await render(
			<MarkInk tier="insetRow">
				<Probe />
			</MarkInk>
		);
		expect(inside("probe").props.children).not.toBe(outside("probe").props.children);
	});
});
