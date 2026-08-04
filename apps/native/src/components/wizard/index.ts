import { WizardContent, WizardStep } from "./content";
import { StackedActions } from "./stacked-actions/container";
import { StackedActionsItem } from "./stacked-actions/item";
import { useWizard, Wizard as WizardRoot } from "./wizard";

export const Wizard = Object.assign(WizardRoot, {
	Content: WizardContent,
	Step: WizardStep,
	Actions: Object.assign(StackedActions, { Item: StackedActionsItem }),
});

export type { WizardStepProps } from "./content";
export type { StackedActionsProps } from "./stacked-actions/container";
export type { StackedActionsItemProps } from "./stacked-actions/item";
export type { WizardApi, WizardProps } from "./wizard";
export { useWizard };
