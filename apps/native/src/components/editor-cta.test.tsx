import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { EditorCta } from "./editor-cta";

/**
 * The CTA is a `panelui` button now, not a SwiftUI one, so these assert what a
 * caller can observe — the label, whether it fires, and the disabled state
 * — rather than a modifier list.
 */
describe("editorCta", () => {
    it("renders the label passed in", async () => {
        await render(<EditorCta canSave label="Add Category" onPress={() => {}} />);
        expect(screen.getByText("Add Category")).toBeTruthy();
    });

    it("fires onPress when it can save", async () => {
        const onPress = jest.fn();
        await render(<EditorCta canSave label="Add Category" onPress={onPress} />);

        fireEvent.press(screen.getByText("Add Category"));

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("marks itself disabled when canSave is false", async () => {
        await render(<EditorCta canSave={false} label="Add Category" onPress={() => {}} />);
        expect(screen.getByRole("button")).toBeDisabled();
    });

    /**
     * The regression this guards: panelui's own `opacity-[0.64]` never lands,
     * because its `AnimatedPressable` drives `opacity` from a press style. A
     * disabled CTA that stays at full ink reads as tappable, so the dim lives
     * on the wrapper and has to keep living there.
     */
    it("dims itself when it cannot save", async () => {
        await render(<EditorCta canSave={false} label="Add Category" onPress={() => {}} />);
        expect(screen.getByTestId("editor-cta")).toHaveStyle({ opacity: 0.4 });
    });

    it("stays at full ink while saving", async () => {
        await render(<EditorCta busy canSave={false} label="Add Category" onPress={() => {}} />);
        expect(screen.getByTestId("editor-cta")).toHaveStyle({ opacity: 1 });
    });

    it("is disabled while saving", async () => {
        await render(<EditorCta busy canSave label="Add Category" onPress={() => {}} />);
        expect(screen.getByRole("button")).toBeDisabled();
    });
});
