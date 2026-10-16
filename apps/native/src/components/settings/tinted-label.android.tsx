import type { TintedLabel as IosTintedLabel } from "@/components/settings/tinted-label";

export type { TintedLabelProps } from "@/components/settings/tinted-label";

/**
 * Glow registers `TintedLabelView` only in its Swift module, and mounting an
 * unregistered view is a fatal Fabric crash, so Android never looks it up.
 */
export const TintedLabel: typeof IosTintedLabel = () => null;

export const tintedLabelAvailable = false;
