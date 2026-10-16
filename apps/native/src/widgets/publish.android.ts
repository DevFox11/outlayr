import type { publishWidgets as iosPublishWidgets } from "@/widgets/publish";

/**
 * There is nothing to publish to on Android yet: every widget, the watch, Siri
 * and Wallet are iOS-only. A sibling rather than the iOS early return, so the
 * four widget layouts and the `@expo/ui/swift-ui` views they pull in stay out of
 * the Android bundle entirely.
 */
export const publishWidgets: typeof iosPublishWidgets = async () => undefined;
