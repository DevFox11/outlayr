import {
	Children,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { View } from "react-native";
import { StepTransition } from "./step-transition";
import { useWizard } from "./wizard";

export interface WizardStepProps {
	name: string;
	children?: ReactNode;
}

export function WizardStep({ children }: WizardStepProps) {
	return <>{children}</>;
}

interface WizardContentProps {
	children: ReactNode;
}

export function WizardContent({ children }: WizardContentProps) {
	const { step, steps, direction } = useWizard();
	const seen = new Set<string>();
	let active: ReactElement<WizardStepProps> | null = null;

	for (const child of Children.toArray(children)) {
		if (!isValidElement<WizardStepProps>(child) || child.type !== WizardStep) {
			if (__DEV__) {
				throw new Error("Wizard.Content: every child must be a <Wizard.Step>.");
			}
			continue;
		}
		const name = child.props.name;
		if (__DEV__) {
			if (seen.has(name)) {
				throw new Error(
					`Wizard.Content: duplicate <Wizard.Step name="${name}">.`,
				);
			}
			if (!steps.includes(name)) {
				throw new Error(
					`Wizard.Content: <Wizard.Step name="${name}"> is not one of the declared steps [${steps.join(", ")}].`,
				);
			}
		}
		seen.add(name);
		if (name === step) {
			active = child;
		}
	}

	return (
		<View className="flex-1 overflow-hidden">
			<StepTransition direction={direction} step={step}>
				{active}
			</StepTransition>
		</View>
	);
}
