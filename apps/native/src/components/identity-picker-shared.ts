import type { ImagePickerErrorResult, ImagePickerResult } from "expo-image-picker";

import { CATEGORY_PALETTE } from "@/data/categories-core";
import type { TranslationKey } from "@/i18n/catalog";
import { persistPickedPhoto } from "@/lib/photo-storage";
import { glowFromImage } from "@/theme/glow";

/**
 * What both identity pickers share: the selection they edit, their tabs, and
 * what each pick does to the selection. `identity-picker-content.tsx` draws it
 * in SwiftUI and `identity-picker-content.android.tsx` in RN and Compose.
 */

export interface IdentitySelection {
    color: string | null;
    emoji: string | null;
    icon: string | null;
    /** Photo glow color — auto-detected from the image, overridable via the swatch. */
    photoColor: string | null;
    photoUri: string | null;
}

export type IdentityTab = "photo" | "emoji" | "icons";

export const TRANSACTION_TABS: readonly IdentityTab[] = ["photo", "emoji", "icons"];
/** A category is a glyph, never a photo. */
export const CATEGORY_TABS: readonly IdentityTab[] = ["icons", "emoji"];

export const IDENTITY_TAB_LABEL = {
    emoji: "transaction.identity.tab.emoji",
    icons: "transaction.identity.tab.icons",
    photo: "transaction.identity.tab.photo",
} satisfies Record<IdentityTab, TranslationKey>;

export interface IdentityPickerContentProps {
    onChange: (next: IdentitySelection) => void;
    onDone: () => void;
    /** Off for income and for subcategories. */
    showsColorRail?: boolean;
    /** Which tabs the sheet offers, in display order. */
    tabs?: readonly IdentityTab[];
    /** Glyph wash / highlight color: the chosen category color, or income green. */
    tint?: string;
    /** Colors sibling expense categories already own; dimmed and unpickable. */
    usedColors?: readonly string[];
    value: IdentitySelection;
}

/** The tab the picker opens on: the one holding the current pick, else the first. */
export function initialIdentityTab(value: IdentitySelection, tabs: readonly IdentityTab[]): IdentityTab {
    if (value.icon && tabs.includes("icons")) {
        return "icons";
    }
    if (value.emoji && tabs.includes("emoji")) {
        return "emoji";
    }
    if (value.photoUri && tabs.includes("photo")) {
        return "photo";
    }
    return tabs[0];
}

/** An emoji replaces whatever glyph or photo was there; the colour stays. */
export function withEmoji(value: IdentitySelection, emoji: string): IdentitySelection {
    return {
        color: value.color,
        emoji,
        icon: null,
        photoColor: null,
        photoUri: null,
    };
}

/** An icon needs a colour to be drawn in, so an unset one takes the palette's first. */
export function withIcon(value: IdentitySelection, icon: string): IdentitySelection {
    return {
        color: value.color ?? CATEGORY_PALETTE[0],
        emoji: null,
        icon,
        photoColor: null,
        photoUri: null,
    };
}

/** A photo replaces any glyph, and its glow colour is the first extracted hue. */
export function withPhoto(value: IdentitySelection, photoUri: string, hues: readonly string[]): IdentitySelection {
    return {
        color: value.color,
        emoji: null,
        icon: null,
        photoColor: hues[0] ?? null,
        photoUri,
    };
}

/**
 * The photo a system picker result carries, if any: null for a cancel, an
 * error, or no result at all (`getPendingResultAsync` with nothing pending).
 */
export function pickedPhotoUri(result: ImagePickerResult | ImagePickerErrorResult | null): string | null {
    if (result == null || !("canceled" in result) || result.canceled) {
        return null;
    }
    return result.assets[0]?.uri ?? null;
}

/**
 * Copies a photo the system picker returned into app storage and reads its
 * glow. A failed copy still leaves a usable picture for this session, and the
 * launch reconcile adopts it while the cache entry survives. An unreadable
 * image costs the extracted tint alone: `glowFromImage` resolves to `[]`
 * rather than rejecting, so the photo is still adopted.
 */
export async function adoptPickedPhoto(value: IdentitySelection, pickedUri: string): Promise<IdentitySelection> {
    const uri = await persistPickedPhoto(pickedUri).catch((cause: unknown) => {
        console.error("Failed to store the picked photo", cause);
        return pickedUri;
    });
    return withPhoto(value, uri, await glowFromImage(uri));
}
