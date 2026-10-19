/**
 * `build` for a list that grows at its end. A call whose items start with the
 * previous call's items, the same objects in the same order, builds only the
 * items after them and `join`s that onto the previous result; any other call
 * builds them all. It holds the previous call, so make one per list.
 */
export function growing<Item, Built>(
    build: (items: readonly Item[]) => Built,
    join: (held: Built, added: Built, items: readonly Item[]) => Built
): (items: readonly Item[]) => Built {
    let previous: { built: Built; items: readonly Item[] } | null = null;
    return (items) => {
        const held = previous;
        const grew =
            held !== null &&
            held.items.length <= items.length &&
            held.items.every((item, index) => item === items[index]);
        const built = grew ? join(held.built, build(items.slice(held.items.length)), items) : build(items);
        previous = { built, items };
        return built;
    };
}
