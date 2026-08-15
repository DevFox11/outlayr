import { describe, expect, it, jest } from "@jest/globals";
import { SectionList } from "@legendapp/list/section-list";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

interface Row {
    id: string;
}

const sections = (ids: string[]) => (ids.length === 0 ? [] : [{ data: ids.map((id) => ({ id })), key: "day" }]);

/**
 * Deleting the last visible row empties the list while the undo toast is up, and
 * undo refills it. On that empty -> non-empty transition `@legendapp/list` used
 * to reset its layout readiness signal from inside the list's own render, which
 * React reported as `ContainersLayer2` updating during `LegendListInner2`'s
 * render (#452). Fixed in 3.3.5 by moving the reset into a layout effect.
 */
describe("legend list", () => {
    it("refills after emptying without updating state during render", async () => {
        const errors: string[] = [];
        const spy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
            errors.push(args.map(String).join(" "));
        });
        // Rows measure to nothing under the synthetic layout below, which the list
        // reports as an exhausted container pool.
        const warnSpy = jest.spyOn(console, "warn").mockReturnValue(undefined);

        const list = (ids: string[]) => (
            <SectionList
                keyExtractor={(item: Row) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: Row }) => <Text>{item.id}</Text>}
                renderSectionHeader={() => <Text>header</Text>}
                sections={sections(ids)}
                testID="list"
            />
        );

        const view = await render(list(["a"]));
        // The container layer that carries the readiness signal only mounts once
        // the list has measured, and jest runs no layout pass.
        await act(async () => {
            fireEvent(view.getByTestId("list"), "layout", {
                nativeEvent: { layout: { height: 800, width: 400, x: 0, y: 0 } },
            });
        });
        await act(async () => {
            view.rerender(list([]));
        });
        await act(async () => {
            view.rerender(list(["a"]));
        });

        spy.mockRestore();
        warnSpy.mockRestore();
        expect(errors.filter((message) => message.includes("while rendering a different component"))).toStrictEqual([]);
    });
});
