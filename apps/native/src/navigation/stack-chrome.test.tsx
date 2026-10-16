import { describe, expect, it } from "@jest/globals";
import type { NativeStackNavigationOptions } from "expo-router";
import { Stack } from "expo-router";
import { appendScreenStackPropsToOptions } from "expo-router/build/layouts/stack-utils/StackScreen";
import type { ReactElement } from "react";

import closeLightIcon from "@/assets/toolbar-icons/close-light.png";
import closeIcon from "@/assets/toolbar-icons/close.png";
import { MATERIAL_ROLES } from "@/theme/material-roles";
import type { MaterialRoleColors } from "@/theme/material-roles";

import { stackChrome } from "./stack-chrome";
import { stackChrome as androidStackChrome } from "./stack-chrome.android";

// SAFETY: one distinct colour per role, so a wrong role shows up as a wrong value.
const M3 = Object.fromEntries(
    MATERIAL_ROLES.map((role, index) => [role, `#0000${index.toString(16).padStart(2, "0")}`])
) as MaterialRoleColors;

/**
 * What the root layout declared before the options moved here: `options` plus
 * header children, resolved the way expo-router resolves them.
 */
function declared(options: NativeStackNavigationOptions, children: ReactElement[] = []) {
    return appendScreenStackPropsToOptions({}, { children, name: "screen", options });
}

const isUnset = (value: unknown): boolean =>
    value === undefined ||
    (typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every(isUnset));

/**
 * Drops what the children spell out but the stack already assumes: unset keys,
 * style objects with nothing set, and `headerShown` / `headerBackVisible` at
 * their default.
 */
function settled(options: NativeStackNavigationOptions) {
    return Object.fromEntries(
        Object.entries(options).filter(
            ([key, value]) =>
                !isUnset(value) && !((key === "headerShown" || key === "headerBackVisible") && value === true)
        )
    );
}

const TITLED = (title: string) => [
    <Stack.Header key="header" transparent />,
    <Stack.Screen.BackButton displayMode="minimal" key="back" />,
    <Stack.Screen.Title key="title">{title}</Stack.Screen.Title>,
];

describe("stack chrome on iOS", () => {
    const chrome = stackChrome(M3);

    it("is exactly what the root layout's header children produced", () => {
        const cases: [NativeStackNavigationOptions, NativeStackNavigationOptions][] = [
            [chrome.titled("About"), declared({}, TITLED("About"))],
            [
                chrome.sheet({ detent: 0.65, title: "New category" }),
                declared(
                    {
                        presentation: "formSheet",
                        sheetAllowedDetents: [0.65, 1],
                        sheetGrabberVisible: true,
                        title: "New category",
                    },
                    TITLED("New category")
                ),
            ],
            [chrome.modal("New"), declared({ presentation: "modal" }, TITLED("New"))],
            [
                chrome.search("Search"),
                declared({ presentation: "modal", sheetGrabberVisible: true }, [
                    <Stack.Header key="header" transparent />,
                    <Stack.Screen.Title key="title">Search</Stack.Screen.Title>,
                ]),
            ],
            [
                chrome.paywall,
                declared({ presentation: "modal", sheetGrabberVisible: true, title: "" }, [
                    <Stack.Header key="header" transparent />,
                ]),
            ],
            [
                chrome.entrySheet,
                declared({ presentation: "formSheet", title: "" }, [<Stack.Header key="header" transparent />]),
            ],
            [
                chrome.pickerSheet(0.5),
                declared({
                    headerShown: false,
                    presentation: "formSheet",
                    sheetAllowedDetents: [0.5, 1],
                    sheetCornerRadius: 40,
                    sheetGrabberVisible: true,
                }),
            ],
            [
                chrome.identityPicker(0.5),
                declared({
                    headerShown: false,
                    presentation: "formSheet",
                    sheetAllowedDetents: [0.5, 1],
                    sheetCornerRadius: 40,
                    sheetGrabberVisible: true,
                    sheetLargestUndimmedDetentIndex: 0,
                }),
            ],
            [chrome.bareModal, declared({ headerShown: false, presentation: "modal" })],
            [chrome.pushed, declared({})],
        ];

        for (const [moved, before] of cases) {
            expect(settled(moved)).toStrictEqual(settled(before));
        }
    });
});

describe("stack chrome on Android", () => {
    const chrome = androidStackChrome(M3);

    it("puts every titled screen under an opaque surface bar with a start-aligned sans title", () => {
        for (const options of [chrome.titled("About"), chrome.pushed, chrome.modal("New"), chrome.search("Search")]) {
            expect(options).toMatchObject({
                headerLargeTitle: false,
                headerStyle: { backgroundColor: M3.surface },
                headerTitleAlign: "left",
                headerTitleStyle: { color: M3.onSurface, fontFamily: "GoogleSansFlex_400Regular", fontSize: 22 },
                headerTransparent: false,
            });
        }
    });

    it("presents modals as full-screen dialogs that close with an X", () => {
        for (const options of [chrome.modal("New"), chrome.paywall]) {
            expect(options).toMatchObject({ animation: "slide_from_bottom", presentation: "modal" });
            expect(options.headerBackImageSource).toBeDefined();
        }
        // Search is somewhere you go back from, so it keeps the arrow.
        expect(chrome.search("Search").headerBackImageSource).toBeUndefined();
    });

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
