import { Text } from "react-native";

import { cn } from "./tw";

interface MonoLabelProps {
    /**
     * `"header"` when the label titles a section. Without it the VoiceOver rotor's
     * Headings mode finds nothing, and the only way past a section is to swipe
     * through every row in it.
     */
    accessibilityRole?: "header";
    children: string;
    className?: string;
    /** Clamps the eyebrow, for rows where it shares a line with other content. */
    numberOfLines?: number;
}

/** Callers pass already-composed copy, e.g. "SPENT · THIS MONTH". */
export function MonoLabel({ accessibilityRole, children, className, numberOfLines }: MonoLabelProps) {
    return (
        <Text
            accessibilityRole={accessibilityRole}
            className={cn("text-eyebrow text-muted tracking-eyebrow font-mono uppercase", className)}
            numberOfLines={numberOfLines}
        >
            {children}
        </Text>
    );
}
