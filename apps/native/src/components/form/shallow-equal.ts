export function shallowEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) {
		return true;
	}
	if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
		return false;
	}
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) {
		return false;
	}
	return aKeys.every(
		(key) =>
			Object.hasOwn(b, key) && Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
	);
}
