/**
 * Nothing on Android. A modal there is a full-screen dialog whose app bar
 * already carries an X as its navigation icon (`stack-chrome.android.ts`), and
 * a form sheet has no app bar at all: `SheetHeader` draws its close button.
 */
export function CloseToolbar(_props: { placement: "left" | "right" }) {
    return null;
}
