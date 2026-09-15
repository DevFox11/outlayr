import type { Device, Orientation, SlideLayout, Theme, ThemeId } from "./types";

// ---------- Export sizes per device ----------
type ExportSize = { label: string; w: number; h: number };

export const EXPORT_SIZES: Record<Device, ExportSize[]> = {
  iphone: [
    { label: '6.9"', w: 1320, h: 2868 },
    { label: '6.5"', w: 1284, h: 2778 },
    { label: '6.3"', w: 1206, h: 2622 },
    // 1125x2436 is iPhone X / XS / 11 Pro, which App Store Connect files under
    // 5.8". Apple's 6.1" slot is 1179x2556.
    { label: '5.8"', w: 1125, h: 2436 },
  ],
  ipad: [
    { label: '13" iPad',       w: 2064, h: 2752 },
    { label: '12.9" iPad Pro', w: 2048, h: 2732 },
  ],
  android:       [{ label: "Phone",          w: 1080, h: 1920 }],
  "android-7":   [{ label: '7" Portrait',    w: 1200, h: 1920 }],
  "android-10":  [{ label: '10" Portrait',   w: 1600, h: 2560 }],
  "feature-graphic": [{ label: "Feature Graphic", w: 1024, h: 500 }],
};

// Landscape sizes (tablets only)
export const EXPORT_SIZES_LANDSCAPE: Partial<Record<Device, ExportSize[]>> = {
  "android-7":  [{ label: '7" Landscape',  w: 1920, h: 1200 }],
  "android-10": [{ label: '10" Landscape', w: 2560, h: 1600 }],
};

export function supportsLandscape(device: Device): boolean {
  return device in EXPORT_SIZES_LANDSCAPE;
}

export function getExportSizes(device: Device, orientation: Orientation): ExportSize[] {
  if (orientation === "landscape") {
    return EXPORT_SIZES_LANDSCAPE[device] || EXPORT_SIZES[device];
  }
  return EXPORT_SIZES[device];
}

// ---------- Frame aspect ratios ----------
// The single source of truth, consumed BOTH by the bezels in `device-frames.tsx`
// and by the default-placement maths below. They used to be written out twice,
// and had drifted: the tablet pair read 0.667/1.5 against bezels of 5/8 and 8/5,
// and the Android phone was measured with the iPhone mockup's ratio — so the
// default device sat about 6% off its own frame on three of the five devices.
export const FRAME_ASPECT = {
  android: 9 / 19.5,
  ipad: 770 / 1000,
  iphone: 1022 / 2082,
  tabletLandscape: 8 / 5,
  tabletPortrait: 5 / 8,
} as const;

// iPhone mockup screen overlay (pre-measured)
export const PHONE_SCREEN = {
  L: (52 / 1022) * 100,
  T: (46 / 2082) * 100,
  W: (918 / 1022) * 100,
  H: (1990 / 2082) * 100,
  RX: (126 / 918) * 100,
  RY: (126 / 1990) * 100,
};

// ---------- Width formula helpers ----------
export function androidPhoneW(cW: number, cH: number, clamp = 0.84) {
  return Math.min(clamp, 0.72 * (cH / cW) * FRAME_ASPECT.android);
}

export function phoneW(cW: number, cH: number, clamp = 0.84) {
  return Math.min(clamp, 0.72 * (cH / cW) * FRAME_ASPECT.iphone);
}
export function tabletPW(cW: number, cH: number, clamp = 0.80) {
  return Math.min(clamp, 0.72 * (cH / cW) * FRAME_ASPECT.tabletPortrait);
}
export function tabletLW(cW: number, cH: number, clamp = 0.62) {
  return Math.min(clamp, 0.75 * (cH / cW) * FRAME_ASPECT.tabletLandscape);
}
export function ipadW(cW: number, cH: number, clamp = 0.75) {
  return Math.min(clamp, 0.72 * (cH / cW) * FRAME_ASPECT.ipad);
}

// ---------- Themes ----------
export const DEFAULT_THEME_ID: ThemeId = "outlayr-paper";

export const THEMES: Record<string, Theme> = {
  // Verbatim from the app's own light tokens in apps/native/global.css: paper
  // ground, ink type, the brand vermilion as accent. `accent` is rendered as
  // label text, and #c2371b measures 4.78:1 on paper — on the ink ground it
  // falls to 3.42:1, which is why this deck uses no `inverted` slides.
  "outlayr-paper": {
    id: "outlayr-paper",
    name: "Outlayr Paper",
    bg: "#F2F0EA",
    bgAlt: "#17150F",
    fg: "#17150F",
    fgAlt: "#F2EFE8",
    accent: "#C2371B",
    muted: "#6B6557",
  },
};

export function themeById(themeId: string | undefined): Theme {
  return THEMES[themeId || ""] || THEMES[DEFAULT_THEME_ID];
}

export function hasTheme(themeId: string | undefined): boolean {
  return !!themeId && !!THEMES[themeId];
}

export const STORAGE_KEY = "app-store-screenshots:project:v1";
export const PROJECT_SCHEMA_VERSION = 2;

export const DEVICE_LABEL: Record<Device, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  android: "Android Phone",
  "android-7": 'Android 7" Tablet',
  "android-10": 'Android 10" Tablet',
  "feature-graphic": "Feature Graphic",
};

// Friendly labels for slide layouts (used in dropdowns)
export const LAYOUT_LABEL: Record<SlideLayout, string> = {
  hero: "Hero",
  "device-bottom": "Device bottom",
  "device-top": "Device top",
  "two-devices": "Two devices",
  "no-device": "No device",
  "split-landscape": "Split (landscape)",
  "feature-graphic": "Feature graphic",
};

// Short description shown under each layout name
export const LAYOUT_HINT: Record<SlideLayout, string> = {
  hero: "Headline above, device at bottom",
  "device-bottom": "Headline top, device anchored below",
  "device-top": "Flipped — device on top",
  "two-devices": "Layered back + front phones",
  "no-device": "Big standalone headline",
  "split-landscape": "Caption left, device right",
  "feature-graphic": "1024×500 Play Store banner",
};
