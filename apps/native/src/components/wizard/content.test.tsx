import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { WizardContent, WizardStep } from "./content";
import { Wizard } from "./wizard";

type Step = "a" | "b" | "c";
const STEPS = ["a", "b", "c"] as const;

function withWizard(step: Step, children: ReactNode) {
	return (
		<Wizard onExit={jest.fn()} step={step} steps={STEPS}>
			{children}
		</Wizard>
	);
}

describe("WizardContent child validation", () => {
	it("throws in __DEV__ when a child of Content is not a <Wizard.Step>", async () => {
		await expect(
			render(
				withWizard(
					"a",
					<WizardContent>
						<View testID="stray" />
					</WizardContent>,
				),
			),
		).rejects.toThrow();
	});

	it("a conditional `false` child does not shift which step is selected", async () => {
		const { getByText } = await render(
			withWizard(
				"b",
				<WizardContent>
					<WizardStep name="a">
						<Text>A</Text>
					</WizardStep>
					{false}
					<WizardStep name="b">
						<Text>B</Text>
					</WizardStep>
				</WizardContent>,
			),
		);
		expect(getByText("B")).toBeTruthy();
	});

	it("throws in __DEV__ on a duplicate <Wizard.Step name>", async () => {
		await expect(
			render(
				withWizard(
					"a",
					<WizardContent>
						<WizardStep name="a">
							<Text>First</Text>
						</WizardStep>
						<WizardStep name="a">
							<Text>Second</Text>
						</WizardStep>
					</WizardContent>,
				),
			),
		).rejects.toThrow();
	});

	it("outside __DEV__, an invalid child is dropped instead of throwing", async () => {
		const devFlag = globalThis as typeof globalThis & { __DEV__: boolean };
		const original = devFlag.__DEV__;
		devFlag.__DEV__ = false;
		try {
			const { getByText } = await render(
				withWizard(
					"a",
					<WizardContent>
						<View testID="stray" />
						<WizardStep name="a">
							<Text>A</Text>
						</WizardStep>
					</WizardContent>,
				),
			);
			expect(getByText("A")).toBeTruthy();
		} finally {
			devFlag.__DEV__ = original;
		}
	});
});
