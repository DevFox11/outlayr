/**
 * Field-by-field equality over own enumerable properties, for a store selector
 * that rebuilds its object on every read.
 *
 * Branches on `instanceof Object` rather than on a runtime tag: the question is
 * "does this have own properties to compare", and a primitive or null answers no.
 * Two values with no own enumerable properties therefore compare equal — the
 * selector outputs this compares are always records, and `Object.is` above
 * already settles the identical-reference case.
 */
export function shallowEqual<T>(a: T, b: T): boolean {
    if (Object.is(a, b)) {
        return true;
    }
    if (!(a instanceof Object && b instanceof Object)) {
        return false;
    }
    const left = Object.entries(a);
    const right = new Map(Object.entries(b));
    return (
        left.length === right.size && left.every(([key, value]) => right.has(key) && Object.is(value, right.get(key)))
    );
}
