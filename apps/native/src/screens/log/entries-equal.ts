import type { FlatSectionListItem } from "@legendapp/list/section-list";

/** Equal by value over plain data: dates by instant, records and arrays field by field. */
function sameData<T>(a: T, b: T): boolean {
    if (Object.is(a, b)) {
        return true;
    }
    if (a instanceof Date || b instanceof Date) {
        return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
    }
    if (!(a instanceof Object && b instanceof Object)) {
        return false;
    }
    const left = Object.entries(a);
    const right = new Map(Object.entries(b));
    return (
        left.length === right.size && left.every(([key, value]) => right.has(key) && sameData(value, right.get(key)))
    );
}

/**
 * `itemsAreEqual` for the Log's day sections, which every write rebuilds from
 * fresh rows. A header is equal when its whole section is, since its share
 * action carries the day's rows; a row when it is and its section's `view` is.
 */
export function logEntriesEqual<Item, Section extends { view: unknown }>(
    previous: FlatSectionListItem<Item, Section>,
    next: FlatSectionListItem<Item, Section>
): boolean {
    if (previous.kind === "header" && next.kind === "header") {
        return sameData(previous.section, next.section);
    }
    if (previous.kind === "item" && next.kind === "item") {
        return sameData(previous.item, next.item) && sameData(previous.section.view, next.section.view);
    }
    return false;
}
