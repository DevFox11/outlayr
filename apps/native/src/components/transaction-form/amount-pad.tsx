import { ArrowDown01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { HugeiconsIcon } from "@hugeicons/react-native";

import { GlassButton } from "@/components/glass-button";
import type { NumpadMode } from "@/domain/numpad";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { AmountNumpad } from "../amount-numpad";
import { Text } from "../text";
import { TransactionStage } from "./stage/stage";
import type { StageFooter } from "./stage/stage";

interface TransactionFormAmountPadProps {
    /** Returns to whichever step sent us here; absent on the resting keypad. */
    backLabel?: string;
    code: string;
    footer?: StageFooter;
    /** Direction of travel, passed straight to the stage — see its own `forward`. */
    forward?: boolean;
    income: boolean;
    /** Named above the keys, so the stage says what it is entering. */
    label: string;
    minorUnits: number;
    /** Passed straight through — see `AmountNumpad`'s own `mode`. */
    mode?: NumpadMode;
    onBack?: () => void;
    onChange: (next: string) => void;
    /**
     * Opens the currency picker. Omitted for a field whose code is not a
     * currency the user can swap — the rate pad's "VES/USD" pair — and the code
     * then draws as plain text rather than claiming a button role.
     */
    onCodePress?: () => void;
    /** Distinguishes the amount and rate keypads, so the stage animates between them. */
    stepKey: string;
    value: string;
}

/**
 * The amount step: the keypad, docked into the form as a stage body rather than
 * presented over it.
 *
 * It used to be a `BottomSheet native`, which is a second platform sheet on top
 * of the form's own presentation: iOS insets and dims the parent, drops it out
 * of the accessibility tree for as long as the pad is up, and runs that
 * transition again on every amount tap. Docked, nothing presents — and the form
 * can take a detent of its own, which it cannot do while it owns a child sheet.
 *
 * Mounted only while an amount is being entered, so the software keyboard gets
 * the same space when a text field takes focus.
 */
export function TransactionFormAmountPad({
    backLabel,
    code,
    footer,
    forward,
    income,
    label,
    minorUnits,
    mode,
    onBack,
    onChange,
    onCodePress,
    stepKey,
    value,
}: TransactionFormAmountPadProps) {
    const t = useTranslation();
    const colors = useColors();
    // 500 is the heaviest mono face the app loads — see `_layout.tsx`'s
    // `useFonts`, which registers Geist Mono at 400 and 500 only.
    const codeText = <Text className="text-callout text-foreground tracking-eyebrow font-mono-medium">{code}</Text>;
    // Rendered here rather than through the stage's own `rightAction`: that draws
    // a tinted sans label, and the code has to stay mono to read as the figure's
    // unit. A code with nothing to swap to — the rate pad's "VES/USD" pair — is
    // plain text rather than a button claiming an action it does not have.
    /**
     * The keypad's header is the currency and nothing else: naming the field
     * "Amount" restates the sentence directly above it. The chevron is doing real
     * work — it says this opens a list rather than cycling a value, which a bare
     * code could not.
     */
    const currency = onCodePress ? (
        <GlassButton
            accessibilityLabel={t("transaction.amount.changeCurrency")}
            accessibilityValue={{ text: code }}
            className="h-[42px] rounded-full pr-3 pl-4"
            onPress={onCodePress}
        >
            {codeText}
            <HugeiconsIcon color={colors.muted} icon={ArrowDown01Icon} size={16} />
        </GlassButton>
    ) : (
        codeText
    );

    const body = (
        <AmountNumpad
            code={code}
            minorUnits={minorUnits}
            mode={mode}
            onChange={onChange}
            showDisplay={false}
            toneClass={income ? "text-income" : "text-foreground"}
            value={value}
        />
    );
    // `label` names the rate pad, whose header is a pair rather than a control.
    // The money pad carries no title at all — the sentence above already states
    // the amount — so the currency is the header's only element and sits where
    // every other step's trailing control does.
    const shared = onCodePress
        ? { footer, forward, right: currency, stepKey }
        : { footer, forward, right: currency, stepKey, title: label };

    // Branched rather than spread: the stage pairs `onBack` with `backLabel` in a
    // union so a chevron can never ship without a label, and a spread of an
    // optional pair does not narrow to it.
    return onBack && backLabel ? (
        <TransactionStage {...shared} backLabel={backLabel} onBack={onBack}>
            {body}
        </TransactionStage>
    ) : (
        <TransactionStage {...shared}>{body}</TransactionStage>
    );
}
