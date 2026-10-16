import type { HostProps } from "@expo/ui/jetpack-compose";

/** Everything `Host` takes except the two it derives from app state. */
export type MaterialHostProps = Omit<HostProps, "colorScheme" | "seedColor">;

/**
 * The Compose `Host` every Android screen renders Material 3 controls in.
 * Android only: the real one is `material-host.android.tsx`.
 *
 * Throws rather than rendering, because there is nothing safe to render here:
 * a jetpack-compose view mounted on iOS resolves to the SwiftUI view of the same
 * name (`HostView`), which takes different props. Import it from `.android.tsx`
 * siblings only.
 */
export function MaterialHost(_props: MaterialHostProps): never {
    throw new Error("MaterialHost is Android-only. Render it from a .android.tsx sibling.");
}
