const STEP_KEYS = new Map([
    ["ArrowDown", 1],
    ["ArrowLeft", -1],
    ["ArrowRight", 1],
    ["ArrowUp", -1],
]);

export function tabTarget(key: string, current: number, count: number): number | null {
    const step = STEP_KEYS.get(key);
    if (step !== undefined) {
        return (current + step + count) % count;
    }
    if (key === "Home") {
        return 0;
    }
    if (key === "End") {
        return count - 1;
    }
    return null;
}
