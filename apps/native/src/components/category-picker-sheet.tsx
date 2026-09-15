import { BottomSheetModal, BottomSheetScrollView } from "@expo/ui/community/bottom-sheet";
import ArrowRight01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowRight01Icon";
import Cancel01Icon from "@hugeicons-pro/core-stroke-rounded/Cancel01Icon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-rounded/PlusSignIcon";
import Search01Icon from "@hugeicons-pro/core-stroke-rounded/Search01Icon";
import Tick02Icon from "@hugeicons-pro/core-stroke-rounded/Tick02Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Button, InputGroup } from "panelui-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { useCategoriesByNamespace } from "@/data/categories";
import type { Category } from "@/data/categories-core";
import { useRecentCategoryIds } from "@/data/category-recents";
import type { Database } from "@/db/client";
import { expandedForSelectedCategory, searchCategoryTree } from "@/domain/category-search";
import type { CategoryMatch } from "@/domain/category-search";
import { useTranslation } from "@/i18n/context";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

import { CategoryIconTile } from "./category-icon-tile";
import { Text } from "./text";
import { cn } from "./tw";

const EASE = Easing.inOut(Easing.ease);
const CARD_LAYOUT = LinearTransition.duration(300).easing(EASE);
const CHILD_IN = FadeIn.duration(300).easing(EASE);
const CHILD_OUT = FadeOut.duration(300).easing(EASE);

interface CategoryPickerSheetProps {
    db: Database;
    /**
     * Categories the caller cannot accept. A budgeted category is one:
     * `budgets.categoryId` is unique, so picking it would fail on the constraint
     * at save time with nothing on screen to explain why.
     */
    excludeIds?: readonly string[];
    income: boolean;
    /** Omitted by hosts that cannot mint a category, which also hides the create action. */
    onCreate?: (name: string) => void;
    /** Fires on a swipe-dismiss too, so a presenter can undo whatever it did to open this. */
    onDismiss?: () => void;
    onSelect: (category: Category) => void;
    ref?: Ref<BottomSheetModal>;
    selectedId: string | null;
}

export type CategoryPickerSheetRef = BottomSheetModal;

/** Present via the forwarded ref: `ref.current?.present()`. */
export function CategoryPickerSheet({
    onDismiss,
    db,
    excludeIds,
    income,
    selectedId,
    onSelect,
    onCreate,
    ref,
}: CategoryPickerSheetProps) {
    const t = useTranslation();
    const colors = useColors();
    const offered = useCategoriesByNamespace(db, income);
    const blocked = useMemo(() => new Set(excludeIds), [excludeIds]);
    /**
     * A blocked category is not a choice, but it may still hold children that are:
     * a budget on a parent does not stop one on a subcategory, since the schema is
     * unique per exact id. So a blocked parent stays as a container its children
     * hang off, and only a blocked category with nothing left under it goes.
     */
    const categories = useMemo(() => {
        if (blocked.size === 0) {
            return offered;
        }
        return offered
            .map((parent) =>
                parent.children.some((child) => blocked.has(child.id))
                    ? { ...parent, children: parent.children.filter((child) => !blocked.has(child.id)) }
                    : parent
            )
            .filter((parent) => !blocked.has(parent.id) || parent.children.length > 0);
    }, [offered, blocked]);
    const recentIds = useRecentCategoryIds(db, income);
    const sheetRef = useRef<BottomSheetModal>(null);
    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

    const setRefs = useCallback(
        (node: BottomSheetModal | null) => {
            sheetRef.current = node;
            if (!ref) {
                return;
            }
            // React's `Ref` is a callback or an object with `current`; only the
            // second has the property, which is what tells the two apart.
            if ("current" in ref) {
                ref.current = node;
            } else {
                ref(node);
            }
        },
        [ref]
    );

    const seededFor = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        if (categories.length === 0 || seededFor.current === selectedId) {
            return;
        }
        seededFor.current = selectedId;
        const holder = expandedForSelectedCategory(categories, selectedId);
        if (holder.size > 0) {
            // oxlint-disable-next-line react/react-compiler -- a one-time seed, not derived state: after this the set is the user's to collapse, so deriving the selected branch's ancestors on every render would make those rows refuse to close.
            setExpanded((prev) => new Set([...prev, ...holder]));
        }
    }, [categories, selectedId]);

    const toggle = useCallback((id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const dismiss = useCallback(() => sheetRef.current?.dismiss(), []);

    const trimmed = query.trim();
    const searching = trimmed.length > 0;
    const matches = useMemo(
        () => searchCategoryTree(categories, query).filter((match) => !blocked.has(match.category.id)),
        [categories, query, blocked]
    );

    const recents = useMemo(() => {
        if (recentIds.length === 0) {
            return [];
        }
        const byId = new Map<string, Category>();
        for (const parent of categories) {
            byId.set(parent.id, parent);
            for (const child of parent.children) {
                byId.set(child.id, child);
            }
        }
        return recentIds
            .map((id) => byId.get(id))
            .filter((category): category is Category => category != null && !blocked.has(category.id));
    }, [categories, recentIds, blocked]);

    const create = useCallback(() => onCreate?.(trimmed), [onCreate, trimmed]);
    const clearQuery = useCallback(() => setQuery(""), []);
    // The sheet outlives a dismiss, so a parent the user collapsed by hand would
    // stay collapsed on every later present — hiding the selected child's
    // checkmark again. Resetting the set here rather than re-arming the effect
    // above: presenting changes neither of its deps, so it would never re-run.
    const handleDismiss = useCallback(() => {
        clearQuery();
        setExpanded(expandedForSelectedCategory(categories, selectedId));
        onDismiss?.();
    }, [categories, clearQuery, onDismiss, selectedId]);

    let searchPanel: ReactNode = null;
    if (searching && matches.length === 0) {
        searchPanel = (
            <View className="items-center px-2 pt-8">
                <Text className="text-muted text-subtitle text-center">
                    {t("transaction.category.noMatches", { query: trimmed })}
                </Text>
                {onCreate ? (
                    <Pressable
                        accessibilityRole="button"
                        className="bg-surface mt-3.5 flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-60"
                        onPress={create}
                        testID="category-create"
                    >
                        <HugeiconsIcon color={colors.tint} icon={PlusSignIcon} size={15} strokeWidth={2} />
                        <Text className="font-sans-medium text-callout text-foreground">
                            {t("transaction.category.createNamed", { query: trimmed })}
                        </Text>
                    </Pressable>
                ) : null}
            </View>
        );
    } else if (searching) {
        searchPanel = (
            <View className="bg-surface overflow-hidden rounded-xl">
                {matches.map((match, index) => (
                    <CategoryRow
                        category={match.category}
                        crumb={match.parent?.name ?? null}
                        divided={index > 0}
                        highlight={match}
                        key={match.category.id}
                        onSelect={onSelect}
                        selected={match.category.id === selectedId}
                    />
                ))}
            </View>
        );
    }

    return (
        <BottomSheetModal
            backgroundStyle={{ backgroundColor: colors.background }}
            enableDynamicSizing={false}
            enablePanDownToClose
            onDismiss={handleDismiss}
            ref={setRefs}
            snapPoints={["65%", "92%"]}
        >
            <View className="mb-2 justify-center px-5 py-1">
                <Text accessibilityRole="header" className="text-foreground text-center text-lg font-medium">
                    {t("categories.kind.category")}
                </Text>
                <View className="absolute top-0 bottom-0 left-5 justify-center">
                    <Button
                        accessibilityLabel={t("common.close")}
                        className="rounded-full"
                        onPress={dismiss}
                        size="icon"
                        variant="secondary"
                    >
                        <HugeiconsIcon color={colors.foreground} icon={Cancel01Icon} size={22} />
                    </Button>
                </View>
            </View>

            <View className="px-5 pt-3 pb-3">
                <InputGroup>
                    <InputGroup.Prefix className="px-2.5" isDecorative>
                        <HugeiconsIcon color={colors.muted} icon={Search01Icon} size={16} strokeWidth={2} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                        autoCapitalize="none"
                        autoCorrect={false}
                        clearButtonMode="never"
                        onChangeText={setQuery}
                        placeholder={t("transaction.category.search")}
                        returnKeyType="search"
                        size="sm"
                        testID="category-search"
                        value={query}
                    />
                    {searching ? (
                        <InputGroup.Suffix className="px-2.5">
                            <Pressable
                                accessibilityRole="button"
                                hitSlop={8}
                                onPress={clearQuery}
                                testID="category-search-clear"
                            >
                                <HugeiconsIcon color={colors.muted} icon={Cancel01Icon} size={15} strokeWidth={2} />
                            </Pressable>
                        </InputGroup.Suffix>
                    ) : null}
                </InputGroup>
            </View>

            <BottomSheetScrollView
                contentContainerClassName="px-5"
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
            >
                {searching ? (
                    searchPanel
                ) : (
                    <>
                        {recents.length > 0 ? (
                            <>
                                <GroupCaption text={t("transaction.category.recent")} />
                                <View className="mb-4 flex-row flex-wrap gap-2" testID="category-recents">
                                    {recents.map((category) => (
                                        <RecentChip category={category} key={category.id} onSelect={onSelect} />
                                    ))}
                                </View>
                            </>
                        ) : null}

                        <GroupCaption text={t("transaction.category.all")} />
                        <View className="bg-surface overflow-hidden rounded-xl">
                            {categories.map((parent, index) => {
                                const isExpanded = expanded.has(parent.id);
                                return (
                                    <Animated.View key={parent.id} layout={CARD_LAYOUT}>
                                        <CategoryRow
                                            category={parent}
                                            childCount={parent.children.length}
                                            divided={index > 0}
                                            excluded={blocked.has(parent.id)}
                                            expanded={isExpanded}
                                            onSelect={onSelect}
                                            onToggle={toggle}
                                            selected={parent.id === selectedId}
                                        />
                                        {isExpanded
                                            ? parent.children.map((child) => (
                                                  <Animated.View entering={CHILD_IN} exiting={CHILD_OUT} key={child.id}>
                                                      <CategoryRow
                                                          category={child}
                                                          divided
                                                          indented
                                                          onSelect={onSelect}
                                                          selected={child.id === selectedId}
                                                      />
                                                  </Animated.View>
                                              ))
                                            : null}
                                    </Animated.View>
                                );
                            })}
                        </View>
                    </>
                )}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
}

function GroupCaption({ text }: { text: string }) {
    return <Text className="font-sans-medium text-footnote text-muted mb-2 ml-0.5 uppercase">{text}</Text>;
}

function tintFor(category: Category, incomeColor: string): string {
    return category.income ? incomeColor : (category.color ?? "#767676");
}

const RecentChip = memo(({ category, onSelect }: { category: Category; onSelect: (category: Category) => void }) => {
    const colors = useColors();
    return (
        <Pressable
            accessibilityRole="button"
            className="bg-surface flex-row items-center gap-2 rounded-full py-1 pr-3 pl-1 active:opacity-60"
            onPress={() => onSelect(category)}
        >
            <CategoryIconTile
                color={tintFor(category, colors.income)}
                emoji={category.emoji}
                icon={category.icon}
                radius={999}
                size={28}
                type="solid"
            />
            <Text className="font-sans-medium text-foreground text-subtitle" numberOfLines={1}>
                {category.name}
            </Text>
        </Pressable>
    );
});
RecentChip.displayName = "RecentChip";

const CategoryRow = memo(
    ({
        category,
        selected,
        indented = false,
        divided = false,
        childCount = 0,
        excluded = false,
        expanded = false,
        caption,
        crumb = null,
        highlight,
        onSelect,
        onToggle,
    }: {
        category: Category;
        selected: boolean;
        indented?: boolean;
        divided?: boolean;
        childCount?: number;
        /** Present as a container for its children, but not a choice of its own. */
        excluded?: boolean;
        expanded?: boolean;
        caption?: string;
        crumb?: string | null;
        highlight?: CategoryMatch;
        onSelect: (category: Category) => void;
        onToggle?: (id: string) => void;
    }) => {
        const t = useTranslation();
        const colors = useColors();
        const tint = tintFor(category, colors.income);
        const hasChildren = childCount > 0 && onToggle != null;

        return (
            <View>
                {divided ? (
                    <View
                        className={indented ? "ml-[58px]" : undefined}
                        style={{
                            backgroundColor: withAlpha(colors.foreground, 0.07),
                            height: StyleSheet.hairlineWidth,
                        }}
                    />
                ) : null}
                <View className={cn("flex-row items-center gap-3 pr-3.5", indented ? "py-2 pl-11" : "py-2.5 pl-3.5")}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: excluded, selected }}
                        className={cn(
                            "flex-1 flex-row items-center gap-3",
                            excluded ? "opacity-45" : "active:opacity-60"
                        )}
                        disabled={excluded}
                        onPress={() => onSelect(category)}
                        testID={`category-row-${category.id}`}
                    >
                        <CategoryIconTile
                            color={tint}
                            emoji={category.emoji}
                            icon={category.icon}
                            size={indented ? 28 : 34}
                            type="solid"
                        />
                        <View className="flex-1">
                            <Text
                                className={cn(
                                    "font-sans-medium text-foreground",
                                    indented ? "text-subtitle" : "text-callout"
                                )}
                                numberOfLines={1}
                            >
                                {crumb ? (
                                    <Text className="text-muted font-sans" testID={`category-crumb-${category.id}`}>
                                        {`${crumb} › `}
                                    </Text>
                                ) : null}
                                <HighlightedName match={highlight} name={category.name ?? ""} tint={colors.tint} />
                            </Text>
                            {caption ? (
                                <Text className="text-footnote text-muted" numberOfLines={1}>
                                    {caption}
                                </Text>
                            ) : null}
                        </View>
                        {selected ? (
                            <HugeiconsIcon color={colors.tint} icon={Tick02Icon} size={18} strokeWidth={2.4} />
                        ) : null}
                    </Pressable>
                    {hasChildren ? (
                        <Pressable
                            accessibilityLabel={t(
                                expanded ? "transaction.category.a11yCollapse" : "transaction.category.a11yExpand",
                                {
                                    name: category.name ?? "",
                                }
                            )}
                            accessibilityRole="button"
                            className="h-11 flex-row items-center justify-end pl-2 active:opacity-60"
                            hitSlop={6}
                            onPress={() => onToggle(category.id)}
                        >
                            <View
                                className="flex-row items-center gap-1 rounded-full py-1 pr-1.5 pl-2"
                                style={{ backgroundColor: withAlpha(colors.foreground, 0.06) }}
                            >
                                <Text className="text-footnote text-muted font-mono tabular-nums">
                                    {String(childCount)}
                                </Text>
                                <View className={expanded ? "rotate-90" : "rotate-0"}>
                                    <HugeiconsIcon
                                        color={colors.muted}
                                        icon={ArrowRight01Icon}
                                        size={18}
                                        strokeWidth={2}
                                    />
                                </View>
                            </View>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        );
    }
);
CategoryRow.displayName = "CategoryRow";

function HighlightedName({ name, match, tint }: { name: string; match?: CategoryMatch; tint: string }) {
    if (match == null || match.matchLength === 0) {
        return name;
    }
    const end = match.matchStart + match.matchLength;
    return (
        <>
            {name.slice(0, match.matchStart)}
            <Text className="font-sans-bold" style={{ color: tint }}>
                {name.slice(match.matchStart, end)}
            </Text>
            {name.slice(end)}
        </>
    );
}
