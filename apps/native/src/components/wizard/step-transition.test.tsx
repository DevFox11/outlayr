import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { StepTransition } from "./step-transition";

jest.mock("react-native-reanimated", () => ({
	__esModule: true,
	...jest.requireActual("react-native-reanimated"),
	useReducedMotion: jest.fn(() => true),
}));

describe("StepTransition — prop signature carries no Reanimated types", () => {
	it("the exported StepTransitionProps interface names no Reanimated type", () => {
		const source = readFileSync(join(__dirname, "step-transition.tsx"), "utf8");
		const match = source.match(
			/export interface StepTransitionProps\s*{[^}]*}/,
		);
		expect(match).not.toBeNull();
		const body = match?.[0] ?? "";
		expect(body).not.toMatch(/SharedValue|AnimatedStyle|Animated\.\w+/);
	});
});

describe("StepTransition — reduced motion", () => {
	it("omits entering/exiting when useReducedMotion is true", async () => {
		const { getByTestId } = await render(
			<StepTransition direction={1} step="a">
				<Text>content</Text>
			</StepTransition>,
		);
		const container = getByTestId("wizard-step-transition");
		expect(container.props.entering).toBeUndefined();
		expect(container.props.exiting).toBeUndefined();
	});
});
