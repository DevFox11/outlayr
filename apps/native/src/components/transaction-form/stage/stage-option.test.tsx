import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { StageOption } from "./stage-option";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

describe("stageOption", () => {
    it("reports selection to assistive technology", async () => {
        await render(<StageOption label="Groceries" onPress={() => {}} selected />);
        expect(screen.getByRole("button", { name: "Groceries" }).props.accessibilityState?.selected).toBe(true);
    });

    // Absent is not the same as false: an unselected option has to say so, or
    // VoiceOver reads the row as if nothing in it were selectable.
    it("reports the unselected state rather than omitting it", async () => {
        await render(<StageOption label="Groceries" onPress={() => {}} />);
        expect(screen.getByRole("button", { name: "Groceries" }).props.accessibilityState?.selected).toBe(false);
    });

    it("prefers an explicit label over the visible one", async () => {
        await render(<StageOption accessibilityLabel="Groceries category" label="Groceries" onPress={() => {}} />);
        expect(screen.getByRole("button", { name: "Groceries category" })).toBeTruthy();
    });

    // 38pt of pill against a 44pt minimum, so the slop is what makes the target.
    it("carries enough slop to reach a 44pt target", async () => {
        await render(<StageOption label="Groceries" onPress={() => {}} />);
        const { hitSlop } = screen.getByRole("button", { name: "Groceries" }).props;
        expect(hitSlop.top + 38 + hitSlop.bottom).toBeGreaterThanOrEqual(44);
    });
});
