import { toast } from "panelui-native";
import type { ToastHandle } from "panelui-native";

import { NoticeSlip } from "@/components/notice-slip";
import type { NoticeSlipProps, NoticeTone } from "@/components/notice-slip";

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

interface SavedEntry {
    amount: NonNullable<NoticeSlipProps["amount"]>;
    stamp: string;
    tone: Extract<NoticeTone, { kind: "entry" | "transfer" }>;
}

function show(
    notice: Notice & Pick<NoticeSlipProps, "amount" | "stamp" | "tone">,
    duration = notice.actionLabel ? ACTIONABLE_MS : NOTICE_MS
): string {
    return toast.show({
        component: (handle) => (
            <NoticeSlip
                actionLabel={notice.actionLabel}
                amount={notice.amount}
                body={notice.body}
                onAction={() => {
                    notice.onActionPress?.(handle);
                    handle.hide();
                }}
                onDismiss={handle.hide}
                stamp={notice.stamp}
                title={notice.title}
                tone={notice.tone}
            />
        ),
        duration,
        placement: "top",
    });
}

export function notifyFailure(notice: Notice): void {
    show({ ...notice, tone: { kind: "failure" } });
}

export function notifyWarning(notice: Notice): void {
    show({ ...notice, tone: { kind: "warning" } });
}

/**
 * A neutral notice whose action is the point — an undo, say. Returns the toast
 * id, because the window an undo lives in is owned by the caller: it closes when
 * the write commits, not when the toast times out.
 */
export function notifyUndoable(notice: Notice & { duration: number }): string {
    return show({ ...notice, tone: { kind: "removed" } }, notice.duration);
}

export function notifySaved(notice: Notice & SavedEntry): void {
    show(notice);
}

export function dismissNotice(id: string): void {
    toast.hide(id);
}
