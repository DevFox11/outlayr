import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createRef } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { TagPickerSheet } from "./tag-picker-sheet";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
            accent: "#3D7A5C",
            accentForeground: "#FFFFFF",
            background: "#F2F0EA",
            border: "#DAD6C9",
            danger: "#B5482F",
            expense: "#B5482F",
            foreground: "#17150F",
            future: "#8A8578",
            groupedBackground: "#EFEDE6",
            income: "#3D7A5C",
            muted: "#8A8578",
            overBudget: "#B5482F",
            railTrack: "rgba(0,0,0,0.08)",
            separator: "#DAD6C9",
            subtle: "#B4AFA0",
            surface: "#FFFFFF",
            surfaceSecondary: "#F7F5EF",
            tint: "#3D7A5C",
            warning: "#C08A2E",
        }),
}));

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

function containsText(node: JsonNode | JsonNode[] | null, text: string): boolean {
    if (node == null) {
        return false;
    }
    if (Array.isArray(node)) {
        return node.some((child) => containsText(child, text));
    }
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            if (child === text) {
                return true;
            }
            continue;
        }
        if (containsText(child, text)) {
            return true;
        }
    }
    return false;
}

describe("tagPickerSheet", () => {
    it("lands ref on the BottomSheetModal", async () => {
        const ref = createRef<BottomSheetModal>();
        await render(
            <TagPickerSheet onCreate={async () => null} onToggle={() => {}} ref={ref} selected={[]} tags={[]} />
        );
        expect(ref.current).toBeTruthy();
    });

    it("offers a + Add affordance for each pending tag name not already a real tag", async () => {
        const ref = createRef<BottomSheetModal>();
        const { toJSON } = await render(
            <TagPickerSheet
                onCreate={async () => null}
                onToggle={() => {}}
                pendingTagNames={["Streaming", "Subscription"]}
                ref={ref}
                selected={[]}
                tags={[]}
            />
        );
        await act(async () => {
            ref.current?.present();
        });

        const tree = toJSON() as JsonNode;
        expect(containsText(tree, 'transaction.tags.create:{"name":"Streaming"}')).toBe(true);
        expect(containsText(tree, 'transaction.tags.create:{"name":"Subscription"}')).toBe(true);
    });

    it("does not offer a pending affordance for a name that already answers to a real tag", async () => {
        const ref = createRef<BottomSheetModal>();
        const { toJSON } = await render(
            <TagPickerSheet
                onCreate={async () => null}
                onToggle={() => {}}
                pendingTagNames={["Streaming"]}
                ref={ref}
                selected={[]}
                tags={[{ color: null, id: "t1", name: "Streaming", sortOrder: 0 }]}
            />
        );
        await act(async () => {
            ref.current?.present();
        });

        const tree = toJSON() as JsonNode;
        expect(containsText(tree, 'transaction.tags.create:{"name":"Streaming"}')).toBe(false);
        expect(containsText(tree, "Streaming")).toBe(true);
    });

    it("creates once when the affordance is tapped twice before the insert commits", async () => {
        // `canCreate` reads the `tags` prop, which only gains the row once the
        // insert has committed — so the affordance stays pressable for the whole
        // write and nothing but the guard stops the second tap.
        let settle: ((id: string) => void) | undefined;
        const onCreate = jest.fn(
            () =>
                new Promise<string | null>((resolve) => {
                    settle = resolve;
                })
        );
        const ref = createRef<BottomSheetModal>();
        await render(
            <TagPickerSheet
                onCreate={onCreate}
                onToggle={() => {}}
                pendingTagNames={["Streaming"]}
                ref={ref}
                selected={[]}
                tags={[]}
            />
        );
        await act(async () => {
            ref.current?.present();
        });

        // Not `fireEvent.press`: the sheet's own host sits under `pointerEvents:
        // "none"`, which the press helper honours. `category-picker-sheet` taps
        // through the same `onClick` for the same reason.
        const affordance = screen.getByRole("button", { name: 'transaction.tags.create:{"name":"Streaming"}' });
        fireEvent(affordance, "click");
        fireEvent(affordance, "click");
        expect(onCreate).toHaveBeenCalledTimes(1);

        await act(async () => {
            settle?.("t1");
        });
        fireEvent(affordance, "click");
        expect(onCreate).toHaveBeenCalledTimes(2);
    });
});
