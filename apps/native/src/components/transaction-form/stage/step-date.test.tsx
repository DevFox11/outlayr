import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { StepDate } from "./step-date";

const DATE = new Date(2026, 6, 15, 21, 30);

interface Node {
    children: (Node | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

function findByProp(node: Node | Node[] | null, key: string, match: (value: unknown) => boolean): Node | null {
    if (node == null) {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findByProp(child, key, match);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (match(node.props?.[key])) {
        return node;
    }
    for (const child of node.children ?? []) {
        if (typeof child !== "string") {
            const found = findByProp(child, key, match);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

const picker = (tree: Node) => findByProp(tree, "onDateChange", (value) => typeof value === "function");

describe("stepDate", () => {
    it("renders the day wheel on the entry's own date", async () => {
        const { toJSON } = await render(<StepDate date={DATE} onChange={jest.fn()} />);

        const node = picker(toJSON() as Node);
        expect(node).not.toBeNull();
        expect(node?.props.displayedComponents).toStrictEqual(["date"]);
    });

    // The transaction's own date carries a clock, which is stored with the row;
    // a schedule's end date does not.
    it("adds the clock only when the host asks for it", async () => {
        const { toJSON } = await render(<StepDate date={DATE} onChange={jest.fn()} withTime />);

        expect(picker(toJSON() as Node)?.props.displayedComponents).toStrictEqual(["date", "hourAndMinute"]);
    });

    it("reports a change through the host's callback", async () => {
        const onChange = jest.fn();
        const { toJSON } = await render(<StepDate date={DATE} onChange={onChange} />);

        const onDateChange = picker(toJSON() as Node)?.props.onDateChange as (event: unknown) => void;
        onDateChange({ nativeEvent: { date: new Date(2026, 6, 10).getTime() } });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect((onChange.mock.calls[0] as [Date])[0].getDate()).toBe(10);
    });
});
