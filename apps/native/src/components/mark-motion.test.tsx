import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { StyleSheet, Text, type ViewStyle } from "react-native";

import { Arrive, Fade } from "./mark-motion";

const mockStill = jest.fn(() => false);
jest.mock("react-native-reanimated", () => {
	const actual = jest.requireActual("react-native-reanimated");
	return { __esModule: true, ...actual, useReducedMotion: () => mockStill() };
});

beforeEach(() => {
	mockStill.mockReturnValue(false);
});

async function rootStyle(ui: ReactElement): Promise<ViewStyle> {
	const tree = (await render(ui)).toJSON();
	if (!tree || Array.isArray(tree)) {
		throw new Error("expected a single root node");
	}
	return (StyleSheet.flatten(tree.props.style) ?? {}) as ViewStyle;
}

describe("Arrive", () => {
	it("renders what is arriving", async () => {
		const { getByText } = await render(
			<Arrive>
				<Text>row</Text>
			</Arrive>
		);

		expect(getByText("row")).toBeTruthy();
	});

	it("renders the settled frame and no travel when Reduce Motion is on", async () => {
		mockStill.mockReturnValue(true);

		const style = await rootStyle(
			<Arrive>
				<Text>row</Text>
			</Arrive>
		);

		expect(style.opacity ?? 1).toBe(1);
		expect(style.transform).toBeUndefined();
	});

	it("keeps the caller's layout style in both branches", async () => {
		const moving = await rootStyle(
			<Arrive style={{ marginTop: 7 }}>
				<Text>row</Text>
			</Arrive>
		);
		mockStill.mockReturnValue(true);
		const settled = await rootStyle(
			<Arrive style={{ marginTop: 7 }}>
				<Text>row</Text>
			</Arrive>
		);

		expect(moving.marginTop).toBe(7);
		expect(settled.marginTop).toBe(7);
	});
});

describe("Fade", () => {
	it("renders at its target opacity when Reduce Motion is on", async () => {
		mockStill.mockReturnValue(true);

		const style = await rootStyle(
			<Fade to={0.3}>
				<Text>rule</Text>
			</Fade>
		);

		expect(style.opacity).toBe(0.3);
	});

	it("renders a fully dissolved layer as gone, not as a ghost", async () => {
		mockStill.mockReturnValue(true);

		const style = await rootStyle(
			<Fade to={0}>
				<Text>dashes</Text>
			</Fade>
		);

		expect(style.opacity).toBe(0);
	});
});
