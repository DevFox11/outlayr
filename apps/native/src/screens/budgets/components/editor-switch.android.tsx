import { Switch } from "@expo/ui/jetpack-compose";
import { Pressable, View } from "react-native";

import { MaterialHost } from "@/components/material-host";

import type { EditorSwitchProps } from "./editor-switch";

export type { EditorSwitchProps } from "./editor-switch";

/**
 * The Compose switch in the app's scheme, as on every Android settings row,
 * and handled the same way as `ToggleRow`: the wrapper is the one switch
 * TalkBack reads and the one handler. The Compose switch only pictures the
 * state; a tap on it reaches the wrapper, and a handler of its own would run
 * the change twice.
 */
export function EditorSwitch({ accessibilityLabel, onValueChange, value }: EditorSwitchProps) {
    return (
        <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            hitSlop={8}
            onPress={() => onValueChange(!value)}
        >
            <View importantForAccessibility="no-hide-descendants">
                <MaterialHost matchContents>
                    <Switch value={value} />
                </MaterialHost>
            </View>
        </Pressable>
    );
}
