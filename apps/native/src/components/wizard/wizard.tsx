import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import {
	clampIndex,
	directionFor,
	nextIndex,
	prevIndex,
	resolveStepIndex,
} from "./cursor";

export interface WizardApi<S extends string> {
	readonly steps: readonly S[];
	readonly step: S;
	readonly index: number;
	readonly count: number;
	readonly direction: 1 | -1;
	readonly canGoBack: boolean;
	readonly canGoNext: boolean;
	next(): void;
	back(): void;
	goTo(step: S): void;
	exit(): void;
}

export interface WizardProps<S extends string> {
	steps: readonly [S, ...S[]];
	step?: S;
	defaultStep?: S;
	onStepChange?: (step: S, direction: 1 | -1) => void;
	canLeave?: (step: S) => boolean;
	onExit: () => void;
	children: ReactNode;
}

const noopCanLeave = () => true;

const WizardContext = createContext<WizardApi<string> | null>(null);

/**
 * The cast is the engine's one unsound line: the context is typed against
 * `string` so a single provider can serve any step union, and each caller
 * narrows it back to its own `S` here. `__DEV__` step-name validation in
 * `Wizard.Content` (content.tsx) is what stops that cast from silently
 * lying about `step`.
 */
export function useWizard<S extends string>(): WizardApi<S> {
	const ctx = useContext(WizardContext);
	if (ctx === null) {
		throw new Error("useWizard() must be used within a <Wizard>.");
	}
	return ctx as unknown as WizardApi<S>;
}

export function Wizard<S extends string>({
	steps,
	step: controlledStep,
	defaultStep,
	onStepChange,
	canLeave = noopCanLeave,
	onExit,
	children,
}: WizardProps<S>) {
	const isControlled = controlledStep !== undefined;
	const [uncontrolledIndex, setUncontrolledIndex] = useState(() =>
		clampIndex(
			defaultStep === undefined ? 0 : steps.indexOf(defaultStep),
			steps.length,
		),
	);
	const [direction, setDirection] = useState<1 | -1>(1);

	const index = isControlled
		? clampIndex(steps.indexOf(controlledStep), steps.length)
		: uncontrolledIndex;
	const step = steps[index] as S;

	const moveTo = useCallback(
		(targetIndex: number, dir: 1 | -1) => {
			setDirection(dir);
			if (!isControlled) {
				setUncontrolledIndex(targetIndex);
			}
			const targetStep = steps[targetIndex] as S;
			if (targetStep !== step) {
				onStepChange?.(targetStep, dir);
			}
		},
		[isControlled, steps, step, onStepChange],
	);

	const api = useMemo<WizardApi<S>>(
		() => ({
			steps,
			step,
			index,
			count: steps.length,
			direction,
			canGoBack: index > 0,
			canGoNext: index < steps.length - 1 && canLeave(step),
			next() {
				const target = nextIndex(index, steps.length, canLeave(step));
				if (target === index) {
					return;
				}
				moveTo(target, 1);
			},
			back() {
				const target = prevIndex(index);
				if (target === index) {
					return;
				}
				moveTo(target, -1);
			},
			goTo(target) {
				const targetIndex = resolveStepIndex(steps, target);
				if (targetIndex === null || targetIndex === index) {
					return;
				}
				moveTo(targetIndex, directionFor(index, targetIndex));
			},
			exit() {
				onExit();
			},
		}),
		[steps, step, index, direction, canLeave, onExit, moveTo],
	);

	return (
		<WizardContext.Provider value={api as unknown as WizardApi<string>}>
			{children}
		</WizardContext.Provider>
	);
}
