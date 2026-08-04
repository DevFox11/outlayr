import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { useWizard, Wizard } from "./wizard";

type Step = "source" | "file" | "resolve" | "review";
const STEPS = ["source", "file", "resolve", "review"] as const;

function makeWrapper(props?: {
	step?: Step;
	defaultStep?: Step;
	onExit?: () => void;
	canLeave?: (step: Step) => boolean;
	onStepChange?: (step: Step, direction: 1 | -1) => void;
}) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<Wizard
				canLeave={props?.canLeave}
				defaultStep={props?.defaultStep}
				onExit={props?.onExit ?? jest.fn()}
				onStepChange={props?.onStepChange}
				step={props?.step}
				steps={STEPS}
			>
				{children}
			</Wizard>
		);
	};
}

describe("useWizard", () => {
	it("controlled: step and index derive from the `step` prop", async () => {
		const { result } = await renderHook(() => useWizard<Step>(), {
			wrapper: makeWrapper({ step: "resolve" }),
		});
		expect(result.current.step).toBe("resolve");
		expect(result.current.index).toBe(2);
	});

	it("uncontrolled: starts at defaultStep and advances via next()", async () => {
		const { result } = await renderHook(() => useWizard<Step>(), {
			wrapper: makeWrapper({ defaultStep: "file" }),
		});
		expect(result.current.step).toBe("file");
		await act(() => result.current.next());
		expect(result.current.step).toBe("resolve");
		expect(result.current.index).toBe(2);
	});

	it("clamps a defaultStep outside the declared steps to index 0", async () => {
		const { result } = await renderHook(() => useWizard<Step>(), {
			wrapper: makeWrapper({ defaultStep: "missing" as Step }),
		});
		expect(result.current.index).toBe(0);
		expect(result.current.step).toBe("source");
	});

	it("goTo jumps directly and updates step and index together", async () => {
		const { result } = await renderHook(() => useWizard<Step>(), {
			wrapper: makeWrapper({ defaultStep: "source" }),
		});
		await act(() => result.current.goTo("review"));
		expect(result.current.step).toBe("review");
		expect(result.current.index).toBe(3);
	});

	it("back() at index 0 is a no-op and does not call onExit", async () => {
		const onExit = jest.fn();
		const { result } = await renderHook(() => useWizard<Step>(), {
			wrapper: makeWrapper({ defaultStep: "source", onExit }),
		});
		await act(() => result.current.back());
		expect(result.current.index).toBe(0);
		expect(onExit).not.toHaveBeenCalled();
	});

	it("exit() calls onExit and never touches the cursor", async () => {
		const onExit = jest.fn();
		const { result } = await renderHook(() => useWizard<Step>(), {
			wrapper: makeWrapper({ defaultStep: "file", onExit }),
		});
		await act(() => result.current.exit());
		expect(onExit).toHaveBeenCalledTimes(1);
		expect(result.current.step).toBe("file");
	});

	it("canGoNext is false when canLeave rejects the step, and next() is then a no-op", async () => {
		const { result } = await renderHook(() => useWizard<Step>(), {
			wrapper: makeWrapper({ defaultStep: "source", canLeave: () => false }),
		});
		expect(result.current.canGoNext).toBe(false);
		await act(() => result.current.next());
		expect(result.current.step).toBe("source");
	});

	it("calls onStepChange with the new step and direction on next()", async () => {
		const onStepChange = jest.fn();
		const { result } = await renderHook(() => useWizard<Step>(), {
			wrapper: makeWrapper({ defaultStep: "source", onStepChange }),
		});
		await act(() => result.current.next());
		expect(onStepChange).toHaveBeenCalledWith("file", 1);
	});
});

describe("no route coupling", () => {
	it("the engine never imports expo-router", () => {
		const dir = join(__dirname);
		const offenders: string[] = [];
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) {
				continue;
			}
			const source = readFileSync(join(dir, entry.name), "utf8");
			if (/from ["']expo-router["']/.test(source)) {
				offenders.push(entry.name);
			}
		}
		expect(offenders).toStrictEqual([]);
	});
});
