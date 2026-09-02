import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { EditorCta } from "./editor-cta";

/**
 * The CTA is a `panelui` button now, not a SwiftUI one, so these assert what a
 * caller can observe — the label, whether it fires, and the disabled/busy
 * states — rather than a modifier list.
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

    it("stays at full ink while saving, so the spinner is not also dimmed", async () => {
        await render(<EditorCta busy canSave={false} label="Add Category" onPress={() => {}} />);
        expect(screen.getByTestId("editor-cta")).toHaveStyle({ opacity: 1 });
    });

    // `loading` is why this moved off the SwiftUI button: the save had no visible
    // state before, and panelui disables itself while busy.
    it("is disabled and announced busy while saving", async () => {
        await render(<EditorCta busy canSave label="Add Category" onPress={() => {}} />);

        const button = screen.getByRole("button");
        expect(button).toBeDisabled();
        expect(button.props.accessibilityState.busy).toBe(true);
    });
});

/**
 * `busy` is easy to forget at a call site — the category editor shipped without
 * it, so its save dimmed but never spun, most visibly on subcategory creation
 * where `holdSubmitting()` keeps the handler pending while the route closes.
 * `canSave` already folds in `!isSubmitting`, so the omission is invisible
 * until you watch a real save. A source scan is what catches the next copy.
 */
describe("every EditorCta call site", () => {
    const SRC = join(import.meta.dirname, "..");
    const RENDERS_CTA = /<EditorCta\b/;

    function sourceFiles(dir: string): string[] {
        const files: string[] = [];
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...sourceFiles(full));
                continue;
            }
            if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
                files.push(full);
            }
        }
        return files;
    }

    it("hands it the submitting state, so the save has a visible spinner", () => {
        const offenders = sourceFiles(SRC)
            .filter((file) => {
                const source = readFileSync(file, "utf-8");
                return RENDERS_CTA.test(source) && !/<EditorCta[^>]*\bbusy=/s.test(source);
            })
            .map((file) => file.slice(SRC.length + 1));

        expect(offenders).toStrictEqual([]);
    });
});
