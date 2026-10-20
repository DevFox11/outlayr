import { toolbarDrawable } from "./toolbar-icon-sources";
import type { ToolbarIconName } from "./toolbar-icon-sources";

export type { ToolbarIconName } from "./toolbar-icon-sources";

export function toolbarIcon(name: ToolbarIconName) {
    return { src: toolbarDrawable(name) } as const;
}
