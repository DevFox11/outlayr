import type { MenuAction } from "@expo/ui/community/menu";
import type { ReactNode } from "react";
import type { AccessibilityValue } from "react-native";

interface MaterialMenuBaseProps {
    /** Read as the trigger's own label: the trigger is the button. */
    accessibilityLabel?: string;
    accessibilityValue?: AccessibilityValue;
    /** `@expo/ui`'s menu actions, so a chip hands over what iOS's `MenuView` takes. */
    actions: readonly MenuAction[];
    onPressAction: (id: string) => void;
}

/**
 * The trigger is either `children`, which the menu gives a ripple, or
 * `renderTrigger`, which draws its own pressed state, the way a chip lays a state
 * layer on its shape. A trigger under 48dp should use `renderTrigger`: its touch area
 * grows past what it draws, and a ripple would fill all of it.
 */
export type MaterialMenuProps = MaterialMenuBaseProps &
    (
        | { children: ReactNode; renderTrigger?: never }
        | { children?: never; renderTrigger: (state: { pressed: boolean }) => ReactNode }
    );

/**
 * A Material 3 menu that opens from a tap on its trigger. Android only: the
 * real one is `material-menu.android.tsx`, and iOS keeps `@expo/ui`'s
 * `MenuView`. Throws for the same reason `MaterialHost` does.
 */
export function MaterialMenu(_props: MaterialMenuProps): never {
    throw new Error("MaterialMenu is Android-only. Render it from a .android.tsx sibling.");
}
