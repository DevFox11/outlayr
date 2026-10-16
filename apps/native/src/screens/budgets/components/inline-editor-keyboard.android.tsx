import { HeaderHeightContext } from "expo-router/react-navigation";
import { use } from "react";
import type { ReactNode } from "react";
import { KeyboardAvoidingView } from "react-native";

/**
 * Edge-to-edge means the window no longer resizes for the keyboard, so the
 * scroller is shrunk by hand. A ScrollView that shrinks keeps its focused field
 * in view, which is what brings the name field up above the keys.
 *
 * The offset is the app bar's height: the avoiding view measures itself from
 * the top of the screen's content, under the bar, while the keyboard reports
 * where it starts on the whole screen.
 */
export function InlineEditorKeyboard({ children }: { children: ReactNode }) {
    const headerHeight = use(HeaderHeightContext) ?? 0;
    return (
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={{ flex: 1 }}>
            {children}
        </KeyboardAvoidingView>
    );
}
