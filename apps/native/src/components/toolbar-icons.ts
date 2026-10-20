import { TOOLBAR_SYMBOLS } from "./toolbar-icon-sources";
import type { ToolbarIconName } from "./toolbar-icon-sources";

export type { ToolbarIconName } from "./toolbar-icon-sources";

export function toolbarIcon(name: ToolbarIconName) {
    return { xcasset: `nano.${TOOLBAR_SYMBOLS[name]}` } as const;
}
