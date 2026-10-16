import { Host, RNHostView, ScrollView, useNativeState, VStack } from "@expo/ui/swift-ui";
import {
    animation,
    blur,
    id as scrollId,
    onAppear,
    padding,
    scrollDismissesKeyboard,
    scrollPosition,
    scrollTargetLayout,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactElement, ReactNode } from "react";
import { createContext, use, useState } from "react";
import { StyleSheet, View } from "react-native";

import { FLY_BACK, FLY_UP, FORM_BLUR_RADIUS, HEADER_HEIGHT } from "@/components/editor-style";
import { InlineFailure } from "@/components/form/inline-failure";
import { useColors } from "@/theme/use-colors";
import { useIsDark } from "@/theme/use-is-dark";

import { CURTAIN_LAYER_SIZE, curtainGradient } from "../identity-curtain";

export interface FormScrollProps {
    /** Blurs the form while the identity picker flies up over it. */
    blurred: boolean;
    /** Room under the last item. None while the sheet rests on the sentence. */
    bottomInset: number;
    /** `FormScrollItem`s, plus a `FormScrollStageTarget` when the stage is inline. */
    children: ReactNode;
    /** The identity's hues, washed behind the top of the form. */
    curtainHues: string[] | null;
    /** The last save's failure, pinned in a strip under the header. */
    failure: string | null;
    /** Large text: the stage scrolls inline, and the form follows it to each new step. */
    followsStage: boolean;
    /** The form is an edit sheet. Android pins the failure strip on the sheet's surface then. */
    sheet?: boolean;
}

type StageScroll = ReturnType<typeof useNativeState<string | null>>;

const StageScrollContext = createContext<StageScroll | null>(null);

/**
 * The transaction form's scroller: the sentence, the note and, at large text
 * sizes, the stage. A SwiftUI `ScrollView` in a `Host` whose background is the
 * identity curtain; `form-scroll.android.tsx` is the RN one.
 */
export function FormScroll({ blurred, bottomInset, children, curtainHues, failure, followsStage }: FormScrollProps) {
    const colors = useColors();
    const isDark = useIsDark();
    const stageScroll = useNativeState<string | null>(null);
    /**
     * Measured, not assumed: the strip is pinned over the form, so the scroll
     * content has to be pushed down by exactly what it covers — and what it
     * covers turns on how many lines the message wraps to.
     */
    const [failureHeight, setFailureHeight] = useState(0);

    return (
        <StageScrollContext value={stageScroll}>
            {/* The curtain is the Host's own BACKGROUND, not a sibling: a view stacked
			    before the Host would hide the scroll content from the header's
			    scroll-edge lookup. */}
            <Host
                style={{
                    backgroundColor: colors.background,
                    experimental_backgroundImage: curtainGradient(curtainHues, isDark),
                    experimental_backgroundRepeat: "no-repeat",
                    // Confine every gradient layer to the top CURTAIN_HEIGHT and don't
                    // tile it, so below that band there is only the grouped grey.
                    experimental_backgroundSize: CURTAIN_LAYER_SIZE,
                    flex: 1,
                }}
            >
                {/* The blur goes on the SCROLL VIEW: blurring the `Host` would take the
				    curtain, which is its background, with it. */}
                <ScrollView
                    modifiers={[
                        blur(blurred ? FORM_BLUR_RADIUS : 0),
                        animation(blurred ? FLY_UP : FLY_BACK, blurred),
                        // The note is the one multiline field on this screen, so its
                        // return key writes a newline and cannot also put the keyboard
                        // away. A drag is the way out.
                        scrollDismissesKeyboard("immediately"),
                        ...(followsStage ? [scrollPosition(stageScroll, { anchor: "top" })] : []),
                    ]}
                >
                    <VStack
                        modifiers={[
                            ...(followsStage ? [scrollTargetLayout()] : []),
                            padding({
                                bottom: bottomInset,
                                horizontal: 20,
                                top: failure === null ? 0 : failureHeight,
                            }),
                        ]}
                        spacing={16}
                    >
                        {children}
                    </VStack>
                </ScrollView>
            </Host>

            {/* A strip under the header, not a floating pill: it is the save's own
			    line, and it must not be mistaken for a row of the form. */}
            <View
                className="absolute right-0 left-0 px-5 pt-2"
                onLayout={(e) => setFailureHeight(e.nativeEvent.layout.height)}
                pointerEvents="none"
                style={{
                    backgroundColor: failure === null ? "transparent" : colors.background,
                    borderBottomColor: colors.separator,
                    borderBottomWidth: failure === null ? 0 : StyleSheet.hairlineWidth,
                    // Under the nav bar, which this screen's root runs behind.
                    top: HEADER_HEIGHT,
                }}
            >
                <InlineFailure message={failure} />
            </View>
        </StageScrollContext>
    );
}

/**
 * One RN item in the form. SwiftUI sizes it to its contents. `reveal` is
 * Android's: the item scrolls into view as it mounts.
 */
export function FormScrollItem({ children }: { children: ReactElement; reveal?: boolean }) {
    return <RNHostView matchContents>{children}</RNHostView>;
}

/**
 * Marks where the inline stage starts. Mounting it scrolls the form there, so
 * key it by the stage's turn: each new step mounts a fresh one.
 */
export function FormScrollStageTarget({ id }: { id: string }) {
    const stageScroll = use(StageScrollContext);
    return <VStack modifiers={[scrollId(id), onAppear(() => stageScroll?.set(id))]}>{null}</VStack>;
}
