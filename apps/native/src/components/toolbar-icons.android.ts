import { TOOLBAR_ICON_SOURCES } from "./toolbar-icon-sources";
import type { ToolbarIconName } from "./toolbar-icon-sources";

export type { ToolbarIconName } from "./toolbar-icon-sources";

/** Same as iOS: Android tints a toolbar item from its `tintColor`, not from the source. */
export function toolbarIcon(name: ToolbarIconName) {
    return { icon: TOOLBAR_ICON_SOURCES[name], iconRenderingMode: "template" } as const;
}

/**
 * A bottom toolbar on Android reads only `icon`, as an image source; the
 * loaded `image` iOS needs there is dropped and the button with it. So this is
 * `toolbarIcon` under the hook's name, which keeps the call sites shared.
 */
export function useToolbarIcon(name: ToolbarIconName) {
    return toolbarIcon(name);
}
