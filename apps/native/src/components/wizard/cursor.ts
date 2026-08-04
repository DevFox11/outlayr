export function clampIndex(index: number, count: number): number {
	if (count <= 0) {
		return 0;
	}
	return Math.max(0, Math.min(index, count - 1));
}

export function nextIndex(
	index: number,
	count: number,
	canLeave: boolean,
): number {
	if (!canLeave) {
		return index;
	}
	return clampIndex(index + 1, count);
}

export function prevIndex(index: number): number {
	return Math.max(0, index - 1);
}

export function directionFor(from: number, to: number): 1 | -1 {
	return to < from ? -1 : 1;
}

/**
 * `null` signals a no-op for production; `__DEV__` throws instead so a typo'd
 * `goTo` call fails loudly during development.
 */
export function resolveStepIndex<S extends string>(
	steps: readonly S[],
	step: S,
): number | null {
	const index = steps.indexOf(step);
	if (index !== -1) {
		return index;
	}
	if (__DEV__) {
		throw new Error(
			`Wizard: "${step}" is not one of the declared steps [${steps.join(", ")}]`,
		);
	}
	return null;
}
