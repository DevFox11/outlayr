import type { ReactNode } from "react";
import { View } from "react-native";

/**
 * Compose's `ModalBottomSheet` starts dragging after its 8dp slop and cancels
 * whatever the finger was doing inside it, including a gesture-handler pan,
 * which never asks the views above it to stop intercepting. React Native's
 * responder does ask: granting it with `onResponderGrant` returning true
 * blocks the native responder, `RNHostView` passes that up to Compose, and the
 * sheet leaves the drag to the content for the rest of the gesture.
 */
export function SheetDragRegion({ children }: { children: ReactNode }) {
    return (
        <View
            collapsable={false}
            onResponderGrant={() => true}
            onResponderTerminationRequest={() => false}
            onStartShouldSetResponder={() => true}
        >
            {children}
        </View>
    );
}
