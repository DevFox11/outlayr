import { describe, expect, it, jest } from "@jest/globals";
import { render, screen, userEvent } from "@testing-library/react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { StageOptionRow } from "./stage-options";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

const OPTIONS = [
    { id: "cash", label: "Cash" },
    { id: "card", label: "Card" },
] as const;

describe("stageOptionRow", () => {
    it("draws every option it is given", async () => {
        await render(<StageOptionRow onSelect={() => {}} options={OPTIONS} />);
        expect(screen.getAllByRole("button").map((node) => node.props.accessibilityLabel)).toStrictEqual([
            "Cash",
            "Card",
        ]);
    });

    it("marks only the selected option as selected", async () => {
        await render(<StageOptionRow onSelect={() => {}} options={OPTIONS} selectedId="card" />);
        expect(screen.getByRole("button", { name: "Card" }).props.accessibilityState?.selected).toBe(true);
        expect(screen.getByRole("button", { name: "Cash" }).props.accessibilityState?.selected).toBe(false);
    });

    it("marks nothing while the step has no answer", async () => {
        await render(<StageOptionRow onSelect={() => {}} options={OPTIONS} selectedId={null} />);
        for (const node of screen.getAllByRole("button")) {
            expect(node.props.accessibilityState?.selected).toBe(false);
        }
    });

    it("hands back the id of the option pressed", async () => {
        const onSelect = jest.fn();
        await render(<StageOptionRow onSelect={onSelect} options={OPTIONS} />);
        await userEvent.press(screen.getByRole("button", { name: "Card" }));
        expect(onSelect).toHaveBeenCalledWith("card");
    });
});
