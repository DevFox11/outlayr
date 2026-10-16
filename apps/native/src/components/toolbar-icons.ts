import { useImage } from "expo-image";

import { TOOLBAR_ICON_SOURCES } from "./toolbar-icon-sources";
import type { ToolbarIconName } from "./toolbar-icon-sources";

export type { ToolbarIconName } from "./toolbar-icon-sources";

/**
 * Icon props for a left/right toolbar item. Spread, not passed one prop at a
 * time, so `template` travels with the source — the glyphs are flat black and
 * without it iOS never tints them.
 */
export function toolbarIcon(name: ToolbarIconName) {
    return { icon: TOOLBAR_ICON_SOURCES[name], iconRenderingMode: "template" } as const;
}

/**
 * For a `placement="bottom"` toolbar: iOS ignores an image on `icon` there and
 * reads only `image`, which wants a loaded image rather than a source.
 */
export function useToolbarIcon(name: ToolbarIconName) {
    const image = useImage(TOOLBAR_ICON_SOURCES[name]);
    return { iconRenderingMode: "template", image } as const;
}
