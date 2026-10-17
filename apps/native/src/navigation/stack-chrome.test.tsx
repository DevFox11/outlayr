import { describe, expect, it } from "@jest/globals";

import closeLightIcon from "@/assets/toolbar-icons/close-light.png";
import closeIcon from "@/assets/toolbar-icons/close.png";
import { MATERIAL_ROLES } from "@/theme/material-roles";
import type { MaterialRoleColors } from "@/theme/material-roles";

import { stackChrome as androidStackChrome } from "./stack-chrome.android";

// SAFETY: one distinct colour per role, so a wrong role shows up as a wrong value.
const M3 = Object.fromEntries(
    MATERIAL_ROLES.map((role, index) => [role, `#0000${index.toString(16).padStart(2, "0")}`])
) as MaterialRoleColors;

describe("stack chrome on Android", () => {
    const chrome = androidStackChrome(M3);

    it("bakes the X light on a dark bar and dark on a light one, since the bar can't tint it", () => {
        const on = (surface: string) => androidStackChrome({ ...M3, surface }).modal("New").headerBackImageSource;
        expect(on("#111318")).toBe(closeLightIcon);
        expect(on("#f9f9ff")).toBe(closeIcon);
    });

    it("keeps form sheets as bottom sheets that draw their own header", () => {
        const sheets = [
            chrome.sheet({ detent: 0.65, title: "New category" }),
            chrome.entrySheet,
            chrome.pickerSheet(0.5),
            chrome.identityPicker(0.5),
        ];
        for (const options of sheets) {
            expect(options).toMatchObject({
                contentStyle: { backgroundColor: M3.surfaceContainerLow },
                headerShown: false,
                presentation: "formSheet",
                sheetCornerRadius: 28,
            });
        }
        expect(chrome.sheet({ detent: 0.65, title: "New category" }).sheetAllowedDetents).toStrictEqual([0.65, 1]);
        // The entry sheets are sized by their content: one constant detent, so swiping a raised one down can't crash.
        expect(chrome.entrySheet.sheetAllowedDetents).toBe("fitToContents");
        expect(chrome.entrySheet.sheetResizeAnimationEnabled).toBe(false);
        // Dimmed at every detent, so the editor under the picker can't take taps.
        expect(chrome.identityPicker(0.5).sheetLargestUndimmedDetentIndex).toBeUndefined();
    });
});
