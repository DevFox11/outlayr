import { toast } from "panelui-native";
import type { ToastHandle } from "panelui-native";

/**
 * Transient notices surface as a toast at the top of the screen rather than a
 * modal `Alert`.
 *
 * Two things keep their `Alert`:
 *
 * - Anything that asks a question. A toast auto-dismisses and can be swiped
 *   away, so it can never carry a destructive choice, and its dismissal has to
 *   mean "not now".
 * - Anything raised from a screen presented as a `formSheet` or `modal` that
 *   stays up afterwards. `PanelUIProvider` mounts the toast viewport at the app
 *   root, and a native presentation covers it — measured on the simulator: the
 *   toast never appears, then fades in once the presentation is dismissed. So a
 *   failure that leaves the sheet standing would be silent. Raising one on the
 *   way out is fine, and reads better than an alert with no presenter left.
 */

/** Long enough to look up, find the toast, and read two lines of it. */
const NOTICE_MS = 6000;
/**
 * An action has to be noticed, read, and then reached for, and the reader only
 * starts the second of those once the first is done. Anything shorter turns the
 * button into a dare.
 */
const ACTIONABLE_MS = 10_000;

interface Notice {
    /** Renders a trailing button. Dismissing the toast without pressing it declines. */
    actionLabel?: string;
    /** Supporting line under the title. Omit when the title says it all. */
    body?: string;
    onActionPress?: (handle: ToastHandle) => void;
    title: string;
}

function show(notice: Notice, variant: "default" | "destructive", duration?: number): string {
    return toast.show({
        actionLabel: notice.actionLabel,
        description: notice.body,
        duration: duration ?? (notice.actionLabel ? ACTIONABLE_MS : NOTICE_MS),
        label: notice.title,
        onActionPress: notice.onActionPress,
        placement: "top",
        variant,
    });
}

export function notifyFailure(notice: Notice): void {
    show(notice, "destructive");
}

/**
 * A neutral notice whose action is the point — an undo, say. Returns the toast
 * id, because the window an undo lives in is owned by the caller: it closes when
 * the write commits, not when the toast times out.
 */
export function notifyUndoable(notice: Notice & { duration: number }): string {
    return show(notice, "default", notice.duration);
}

export function dismissNotice(id: string): void {
    toast.hide(id);
}
