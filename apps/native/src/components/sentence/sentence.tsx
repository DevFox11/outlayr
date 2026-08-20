import { createContext, useMemo, use } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { parseSentence } from "@/domain/sentence-template";

import { Text } from "../text";
import { clusterEntering } from "./sentence-motion";

interface SentenceStyle {
    /** Carried to every part so a slot's text matches the words around it. */
    textClassName: string;
}

const SentenceContext = createContext<SentenceStyle | null>(null);

export function useSentenceStyle(): SentenceStyle {
    const value = use(SentenceContext);
    if (value === null) {
        throw new Error("A sentence part must render inside a <Sentence>");
    }
    return value;
}

interface SentenceProps<TSlot extends string> {
    /**
     * A fill per slot the caller's templates use. Declaring the union rather
     * than collecting named children makes a slot the caller forgot a type
     * error instead of a fact missing off the screen.
     */
    slots: Readonly<Record<TSlot, ReactNode>>;
    template: string;
    textClassName?: string;
}

/**
 * `font-sans-medium` rather than a `font-medium` weight: SF Pro Rounded ships as
 * four separate static families and does not synthesize a weight, so naming the
 * face is the only way to reach 500 — see `components/text.tsx`.
 *
 * `text-grammar` reaches only the template's own connector words: every part
 * that fills a slot names its own colour over this one.
 */
const DEFAULT_TEXT = "font-sans-medium text-[26px] leading-[38px] tracking-tight text-grammar";

/**
 * Renders a translated template as running text with its slots filled in.
 *
 * The template owns word order, so this never names a position — a language
 * that puts the account before the category only has to say so in its own
 * string.
 */
export function Sentence<TSlot extends string>({
    slots,
    template,
    textClassName = DEFAULT_TEXT,
}: SentenceProps<TSlot>) {
    const style = useMemo(() => ({ textClassName }), [textClassName]);
    const clusters = useMemo(() => parseSentence(template), [template]);
    // `Object.entries` rather than an indexed read: the record's keys are a
    // union, and a template carries plain strings.
    const fills = useMemo(() => new Map<string, ReactNode>(Object.entries(slots)), [slots]);

    return (
        <SentenceContext value={style}>
            <View className="flex-row flex-wrap items-baseline gap-x-2">
                {clusters.map((cluster, index) => (
                    <Animated.View
                        className="flex-row items-baseline"
                        entering={clusterEntering(index)}
                        // The template is fixed for a given language, so a cluster's
                        // words and position identify it for as long as it exists.
                        key={`${index}:${cluster.atoms.map((atom) => atom.value).join(",")}`}
                    >
                        {cluster.atoms.map((atom, atomIndex) =>
                            atom.kind === "slot" ? (
                                <View key={`${atomIndex}:${atom.value}`}>{fills.get(atom.value) ?? null}</View>
                            ) : (
                                <Text className={textClassName} key={`${atomIndex}:${atom.value}`}>
                                    {atom.value}
                                </Text>
                            )
                        )}
                    </Animated.View>
                ))}
            </View>
        </SentenceContext>
    );
}
