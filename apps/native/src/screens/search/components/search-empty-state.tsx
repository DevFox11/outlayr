import { View } from "react-native";

import { EmptyState, useMark } from "@/components/empty-state";
import { Hairline } from "@/components/empty-state-parts";
import { Fade, Settle } from "@/components/mark-motion";
import { useTranslation } from "@/i18n/context";
import { MARK_MOTION, recedeDelay } from "@/theme/mark-motion";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

interface SearchEmptyStateProps {
    kind: "idle" | "noResults";
    query?: string;
}

export function SearchEmptyState({ kind, query }: SearchEmptyStateProps) {
    const idle = kind === "idle";
    const t = useTranslation();
    return (
        <EmptyState
            body={idle ? t("search.empty.idle.body") : t("search.empty.noResults.body", { query: query ?? "" })}
            className="w-full justify-start px-5 pt-28"
            mark={idle ? <LedgerUnderLens /> : <LedgerEmptied />}
            tier="takeover"
            title={idle ? t("search.empty.idle.title") : t("search.empty.noResults.title")}
        />
    );
}

const PAGE_AVATAR = 20;
const PAGE_PAD = 7;
const RULE = 1;
const ROW_HEIGHT = PAGE_AVATAR + PAGE_PAD * 2;
const DAY_HEIGHT = 22;
const LENS_HEIGHT = 30 + 11 * 2 + 2 * 2;

interface PageRow {
    amount: number;
    kind: "row";
    note: number;
    sub: number;
    underLens?: true;
}

interface PageDay {
    kind: "day";
    label: number;
    total: number;
}

type PageItem = PageRow | PageDay;

const PAGE: readonly PageItem[] = [
    { kind: "day", label: 54, total: 46 },
    { amount: 46, kind: "row", note: 104, sub: 52 },
    { amount: 54, kind: "row", note: 136, sub: 44 },
    { amount: 42, kind: "row", note: 88, sub: 62, underLens: true },
    { kind: "day", label: 48, total: 52 },
    { amount: 50, kind: "row", note: 118, sub: 48 },
    { amount: 44, kind: "row", note: 96, sub: 56 },
    { amount: 58, kind: "row", note: 128, sub: 40 },
];

const LENS_OVER = PAGE.findIndex((item) => item.kind === "row" && item.underLens === true);

const heightOf = (item: PageItem) => (item.kind === "day" ? DAY_HEIGHT : ROW_HEIGHT) + RULE;

const LENS_TOP =
    RULE + PAGE.slice(0, LENS_OVER).reduce((sum, item) => sum + heightOf(item), 0) + (ROW_HEIGHT - LENS_HEIGHT) / 2;

function LedgerUnderLens() {
    return (
        <View className="w-full">
            <View>
                <Hairline opacity={0.55} />
                {PAGE.map((item, index) => (
                    <View
                        key={`${item.kind}-${index === LENS_OVER ? "lens" : ""}${item.kind === "day" ? item.label : item.note}`}
                    >
                        {item.kind === "day" ? (
                            <DayHeader fade={fadeAt(index)} item={item} />
                        ) : (
                            <Row fade={fadeAt(index)} item={item} />
                        )}
                        <Hairline opacity={0.55 * fadeAt(index)} />
                    </View>
                ))}
            </View>

            <View
                className="items-center"
                pointerEvents="none"
                style={{ left: 0, position: "absolute", right: 0, top: LENS_TOP }}
            >
                <Settle style={{ alignItems: "center", width: "100%" }}>
                    <Lens />
                </Settle>
            </View>
        </View>
    );
}

const fadeAt = (index: number) => Math.max(0.34, 1 - index * 0.085);

function DayHeader({ item, fade }: { item: PageDay; fade: number }) {
    const ink = useMark();
    return (
        <View className="flex-row items-center justify-between" style={{ height: DAY_HEIGHT, opacity: fade }}>
            <Bar color={ink.fill} height={6} width={item.label} />
            <Bar color={ink.fill} height={6} width={item.total} />
        </View>
    );
}

function Row({ item, fade }: { item: PageRow; fade: number }) {
    const ink = useMark();
    return (
        <View className="flex-row items-center" style={{ opacity: fade, paddingVertical: PAGE_PAD }}>
            <View
                style={{
                    backgroundColor: ink.fill,
                    borderRadius: PAGE_AVATAR / 2,
                    height: PAGE_AVATAR,
                    width: PAGE_AVATAR,
                }}
            />
            <View style={{ gap: 4, marginLeft: 9 }}>
                <Bar color={ink.fill} height={7} width={item.note} />
                <Bar color={ink.fill} height={5} width={item.sub} />
            </View>
            <View style={{ flex: 1 }} />
            <Bar color={ink.fill} height={7} width={item.amount} />
        </View>
    );
}

function Lens() {
    const colors = useColors();
    const read = withAlpha(colors.foreground, 0.42);
    const quiet = withAlpha(colors.foreground, 0.24);

    return (
        <View
            style={{
                backgroundColor: colors.background,
                borderColor: colors.foreground,
                borderCurve: "continuous",
                borderRadius: 16,
                borderWidth: 2,
                paddingHorizontal: 13,
                paddingVertical: 11,
                shadowColor: "#000000",
                shadowOffset: { height: 3, width: 0 },
                shadowOpacity: 0.07,
                shadowRadius: 9,
                width: "70%",
            }}
        >
            <View className="flex-row items-center">
                <View
                    style={{
                        backgroundColor: read,
                        borderRadius: 15,
                        height: 30,
                        width: 30,
                    }}
                />
                <View style={{ gap: 5, marginLeft: 11 }}>
                    <Bar color={read} height={9} width={84} />
                    <Bar color={quiet} height={7} width={48} />
                </View>
                <View style={{ flex: 1 }} />
                <Bar color={read} height={9} width={44} />
            </View>
        </View>
    );
}

function Bar({ width, height, color }: { width: number; height: number; color: string }) {
    return (
        <View
            style={{
                backgroundColor: color,
                borderRadius: height / 2,
                height,
                width,
            }}
        />
    );
}

function LedgerEmptied() {
    const RULES = [1, 0.72, 0.52, 0.36, 0.24, 0.14, 0.08];
    return (
        <View className="w-full" style={{ gap: 32 }}>
            {RULES.map((opacity, index) => (
                <Fade delay={recedeDelay(index)} duration={MARK_MOTION.recede.duration} key={opacity} to={opacity}>
                    <Hairline />
                </Fade>
            ))}
        </View>
    );
}
