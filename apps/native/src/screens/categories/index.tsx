import { Host } from "@expo/ui";
import {
    Button,
    HStack,
    Image,
    List,
    Rectangle,
    RNHostView,
    Section,
    Spacer,
    Text as SwiftText,
    SwipeActions,
    VStack,
    ZStack,
} from "@expo/ui/swift-ui";
import {
    accessibilityAddTraits,
    buttonStyle,
    font,
    foregroundStyle,
    frame,
    italic,
    lineLimit,
    listRowInsets,
    listRowSeparator,
    multilineTextAlignment,
    offset,
    onTapGesture,
    opacity,
    padding,
} from "@expo/ui/swift-ui/modifiers";
import PlusSignIcon from "@hugeicons-pro/core-stroke-rounded/PlusSignIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Stack, useRouter } from "expo-router";
import { useMemo } from "react";
import { PlatformColor, View } from "react-native";

import { CategoryIconTile } from "@/components/category-icon-tile";
import { CHILD_NAME, CHILD_TILE, Eyebrow, LABEL, PARENT_NAME, PARENT_TILE } from "@/components/category-list-chrome";
import { MarkInk } from "@/components/empty-state";
import { Slot, Tile } from "@/components/empty-state-parts";
import { Fade, Settle } from "@/components/mark-motion";
import { groupedList, groupedRows } from "@/components/native/styles";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { useCategoriesByNamespace, useCategoryTotals } from "@/data/categories";
import { categoriesRepo, presetsNotAdded } from "@/data/categories-core";
import type { Category, CategoryWithChildren, SuggestedCategoryPreset } from "@/data/categories-core";
import { setBoolSetting } from "@/data/settings-core";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import { hitArea, outline } from "@/lib/swift-ui-geometry";
import { staggerDelay } from "@/theme/mark-motion";
import { useColors } from "@/theme/use-colors";
import type { ThemeColors } from "@/theme/use-colors";

/**
 * The row rules paint the translucent `separator` over the card (#E8E8E8 at
 * 1.23:1 light, #38383B at 1.46:1 dark), and as of iOS 26 `opaqueSeparator` sits
 * BELOW that in dark (#2A2A2C, 1.19:1), inverting the hierarchy. `systemGray3`
 * clears the rule in both schemes (1.37x / 1.28x), and being a `PlatformColor` it
 * reads the same trait collection the rules do, so the two can never drift.
 */
const CONNECTOR = PlatformColor("systemGray3");
const CONNECTOR_WEIGHT = 1;

/**
 * Every row zeroes its horizontal `listRowInsets` so the connector can paint edge
 * to edge and consecutive trunks abut, which means the leading gutter the system
 * would supply is re-created here as row padding.
 */
const ROW_LEADING = 16;
const ROW_TRAILING = 20;
const STEM_X = ROW_LEADING + PARENT_TILE / 2;
const ELBOW = 15;
const CHILD_LEADING = STEM_X + ELBOW;
const GROUP_GAP = 10;

const STEM = [foregroundStyle(CONNECTOR), frame({ width: CONNECTOR_WEIGHT })];
/** Not a Spacer — see `TreeConnector`. */
const STEM_HIDDEN = [...STEM, opacity(0)];
const ELBOW_BAR = [foregroundStyle(CONNECTOR), frame({ height: CONNECTOR_WEIGHT, width: ELBOW })];

const NO_RULE = listRowSeparator("hidden");
const FLUSH_ROW = listRowInsets({
    bottom: 0,
    leading: 0,
    top: 0,
    trailing: 0,
});
const PARENT_ROW = listRowInsets({
    bottom: 0,
    leading: 0,
    top: GROUP_GAP,
    trailing: 0,
});
const CLOSING_ROW = listRowInsets({
    bottom: GROUP_GAP,
    leading: 0,
    top: 0,
    trailing: 0,
});

/** Text styles rather than fixed point sizes, so every font scales with Dynamic Type. */
const SUBHEADLINE_MEDIUM = font({
    design: "rounded",
    textStyle: "subheadline",
    weight: "medium",
});
const PARENT_CHEVRON = font({
    design: "rounded",
    textStyle: "footnote",
    weight: "semibold",
});
const CHILD_CHEVRON = font({
    design: "rounded",
    textStyle: "caption",
    weight: "semibold",
});
const SUGGESTED_NAME = font({ design: "rounded", textStyle: "body" });
const SUGGESTED_PLUS = font({ design: "rounded", textStyle: "title3" });
const EMPTY_TEXT = font({
    design: "rounded",
    textStyle: "body",
    weight: "medium",
});

/**
 * Takes the row inside its undo window out of the tree, laid out the way the
 * write will leave it: deleting a parent re-parents its subcategories to the top
 * level, so they are promoted here rather than vanishing with it and popping
 * back somewhere else ten seconds later.
 */
function usePendingRemoved(parents: CategoryWithChildren[], pendingId: string | null): CategoryWithChildren[] {
    return useMemo(() => {
        if (pendingId === null) {
            return parents;
        }
        return parents.flatMap((parent) => {
            if (parent.id === pendingId) {
                return parent.children.map((child) => ({ ...child, children: [] }));
            }
            if (!parent.children.some((child) => child.id === pendingId)) {
                return [parent];
            }
            return [{ ...parent, children: parent.children.filter((child) => child.id !== pendingId) }];
        });
    }, [parents, pendingId]);
}

export function Categories({ income }: { income: boolean }) {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const colors = useColors();
    const currency = useGlobalCurrency(db);
    const showSuggestions = useAppSettings().state.bool("categorySuggestions");
    const namespace = useCategoriesByNamespace(db, income);
    const { pendingId, requestDelete } = useDeferredDelete("category");
    const parents = usePendingRemoved(namespace, pendingId);
    const totals = useCategoryTotals(db);
    const rowGround = groupedRows(colors);

    const suggestions = useMemo(
        () =>
            presetsNotAdded(
                income,
                namespace.flatMap((parent) => [parent, ...parent.children])
            ),
        [income, namespace]
    );

    const goToNewChild = (parent: CategoryWithChildren) => {
        router.push({
            params: { categoryId: parent.id },
            pathname: "/settings/categories/[categoryId]/subcategories/create",
        });
    };

    const goToEdit = (category: Category) => {
        if (category.parentId) {
            router.push({
                params: { categoryId: category.parentId, subcategoryId: category.id },
                pathname: "/settings/categories/[categoryId]/subcategories/[subcategoryId]",
            });
            return;
        }
        router.push({
            params: { categoryId: category.id },
            pathname: "/settings/categories/[categoryId]",
        });
    };

    const goToReorder = () => {
        router.push({
            params: { income: income ? "1" : "0" },
            pathname: "/settings/categories/reorder",
        });
    };

    // The row goes now and the write is held for the undo window, so the toast is
    // the only thing left to state the cascade the confirmation used to carry.
    const deleteCategory = (category: Category, hasChildren: boolean) => {
        requestDelete(category.id, t(hasChildren ? "categories.undo.bodyWithChildren" : "categories.undo.body"));
    };

    const addSuggested = (preset: SuggestedCategoryPreset) => {
        categoriesRepo.addSuggested(db, {
            color: preset.color,
            icon: preset.icon,
            income,
            name: preset.name,
        });
    };

    return (
        <>
            <Stack.Header transparent />
            <Stack.Screen.Title>{t("categories.title")}</Stack.Screen.Title>
            {/* `minimal` keeps the parent route's name ("(tabs)") out of the back button. */}
            <Stack.Screen.BackButton displayMode="minimal" />
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon(showSuggestions ? "suggestionsOn" : "suggestionsOff")}
                    accessibilityLabel={t(
                        showSuggestions ? "categories.a11y.hideSuggestions" : "categories.a11y.showSuggestions"
                    )}
                    onPress={() => {
                        setBoolSetting(db, "categorySuggestions", !showSuggestions);
                    }}
                />
                <Stack.Toolbar.Button
                    {...toolbarIcon("reorder")}
                    accessibilityLabel={t("categories.a11y.reorder")}
                    hidden={parents.length <= 1}
                    onPress={goToReorder}
                />
            </Stack.Toolbar>
            <Host style={{ flex: 1 }} useViewportSizeMeasurement>
                <List modifiers={groupedList(colors)}>
                    {parents.length === 0 ? (
                        <Section modifiers={[rowGround]}>
                            <CategoriesEmpty colors={colors} income={income} />
                        </Section>
                    ) : (
                        <Section header={<CensusLine colors={colors} parents={parents} />} modifiers={[rowGround]}>
                            {parents.map((parent, index) => (
                                <ParentGroup
                                    closesTree={index === parents.length - 1}
                                    colors={colors}
                                    currency={currency}
                                    income={income}
                                    key={parent.id}
                                    onAddChild={goToNewChild}
                                    onDelete={deleteCategory}
                                    onEdit={goToEdit}
                                    parent={parent}
                                    totals={totals}
                                />
                            ))}
                        </Section>
                    )}

                    {showSuggestions && suggestions.length > 0 ? (
                        // A non-empty `title` short-circuits the `header` slot natively, so the
                        // mono eyebrow only lands if the plain-string title is dropped.
                        <Section
                            header={
                                <Eyebrow colors={colors}>
                                    {t("categories.suggested.eyebrow", {
                                        count: suggestions.length,
                                    })}
                                </Eyebrow>
                            }
                            modifiers={[rowGround]}
                        >
                            {suggestions.map((preset) => (
                                <SuggestedRow
                                    colors={colors}
                                    key={`${preset.name}:${preset.icon}`}
                                    onAdd={addSuggested}
                                    preset={preset}
                                />
                            ))}
                        </Section>
                    ) : null}
                </List>
            </Host>
        </>
    );
}

function CensusLine({ parents, colors }: { parents: CategoryWithChildren[]; colors: ThemeColors }) {
    const t = useTranslation();
    const children = parents.reduce((total, parent) => total + parent.children.length, 0);
    // `parents.length` is never zero here — the empty state renders a headerless
    // Section instead.
    const clauses = [t("categories.census.categories", { count: parents.length })];
    if (children > 0) {
        clauses.push(t("categories.census.subcategories", { count: children }));
    }
    return <Eyebrow colors={colors}>{clauses.join(" · ")}</Eyebrow>;
}

type ConnectorKind = "branch" | "last";

/**
 * The elbow lands on the row's vertical centre without anyone measuring the row:
 * SwiftUI hands the fixed-height bar its hairline first, then splits what is left
 * evenly between the two equally-flexible stems.
 *
 * A closing row hides its lower stem rather than dropping it for a `Spacer`. Both
 * do occupy the space, but they do not compete for it equally — a shape is
 * infinitely greedy where a Spacer only takes what is left over, so the stem above
 * ate most of the row and dragged the elbow well below the tile it was pointing at.
 * Two identical rectangles always halve the row, so the elbow stays centred.
 *
 * Only child and closing rows carry a connector. A parent row must not: the stem
 * would have to start at the row's centre, which is also its tile's centre, so the
 * hairline drew straight through the lower half of the glyph. Rows abut, so the
 * first child's stem already begins directly beneath the parent.
 */
function TreeConnector({ kind }: { kind: ConnectorKind }) {
    return (
        <VStack alignment="leading" modifiers={[offset({ x: STEM_X })]} spacing={0}>
            <Rectangle modifiers={STEM} />
            <Rectangle modifiers={ELBOW_BAR} />
            <Rectangle modifiers={kind === "last" ? STEM_HIDDEN : STEM} />
        </VStack>
    );
}

const EMPTY_MARK_TILE = 34;
const EMPTY_MARK_GAP = 11;
const EMPTY_MARK_WIDTH = EMPTY_MARK_TILE * 4 + EMPTY_MARK_GAP * 3;

function CategoryGridOpen({ colors }: { colors: ThemeColors }) {
    return (
        <MarkInk tier="inFlow">
            <View className="flex-row items-center" style={{ gap: EMPTY_MARK_GAP, width: EMPTY_MARK_WIDTH }}>
                <Fade delay={staggerDelay(0)} from={0} to={1}>
                    <Tile opacity={1} size={EMPTY_MARK_TILE} />
                </Fade>
                <Fade delay={staggerDelay(1)} from={0} to={1}>
                    <Tile opacity={0.6} size={EMPTY_MARK_TILE} />
                </Fade>
                <Slot
                    height={EMPTY_MARK_TILE}
                    radius={EMPTY_MARK_TILE * 0.24}
                    style={{ alignItems: "center", justifyContent: "center" }}
                    width={EMPTY_MARK_TILE}
                >
                    <Settle delay={staggerDelay(3)}>
                        <HugeiconsIcon color={colors.foreground} icon={PlusSignIcon} size={15} strokeWidth={2.4} />
                    </Settle>
                </Slot>
                <Fade delay={staggerDelay(2)} from={0} to={1}>
                    <Tile opacity={0.28} size={EMPTY_MARK_TILE} />
                </Fade>
            </View>
        </MarkInk>
    );
}

function CategoriesEmpty({ income, colors }: { income: boolean; colors: ThemeColors }) {
    const t = useTranslation();
    return (
        <VStack modifiers={[frame({ alignment: "center", maxWidth: 10_000 }), padding({ vertical: 37 })]} spacing={10}>
            <RNHostView matchContents>
                <View style={{ height: EMPTY_MARK_TILE, width: EMPTY_MARK_WIDTH }}>
                    <CategoryGridOpen colors={colors} />
                </View>
            </RNHostView>
            <SwiftText
                modifiers={[EMPTY_TEXT, italic(), multilineTextAlignment("center"), foregroundStyle(colors.muted)]}
            >
                {t(income ? "categories.empty.income" : "categories.empty.expense")}
            </SwiftText>
        </VStack>
    );
}

function ParentGroup({
    parent,
    income,
    colors,
    currency,
    totals,
    closesTree,
    onEdit,
    onAddChild,
    onDelete,
}: {
    parent: CategoryWithChildren;
    income: boolean;
    colors: ThemeColors;
    currency: string;
    totals: Map<string, number>;
    closesTree: boolean;
    onEdit: (category: Category) => void;
    onAddChild: (parent: CategoryWithChildren) => void;
    onDelete: (category: Category, hasChildren: boolean) => void;
}) {
    const accent = income ? colors.income : (parent.color ?? colors.foreground);
    const hasChildren = parent.children.length > 0;
    const rolledUpTotal = parent.children.reduce(
        (sum, child) => sum + (totals.get(child.id) ?? 0),
        totals.get(parent.id) ?? 0
    );
    const addTint = income ? colors.tint : accent;

    return (
        <>
            <CategoryRow
                amount={rolledUpTotal}
                category={parent}
                colors={colors}
                currency={currency}
                onDelete={() => onDelete(parent, hasChildren)}
                onEdit={onEdit}
                tint={accent}
            />
            {parent.children.map((child) => (
                <CategoryRow
                    amount={totals.get(child.id) ?? 0}
                    category={child}
                    colors={colors}
                    currency={currency}
                    indented
                    key={child.id}
                    onDelete={() => onDelete(child, false)}
                    onEdit={onEdit}
                    tint={accent}
                />
            ))}
            <GhostAddRow closesTree={closesTree} onPress={() => onAddChild(parent)} tint={addTint} />
        </>
    );
}

function CategoryRow({
    category,
    tint,
    colors,
    currency,
    amount,
    indented = false,
    onEdit,
    onDelete,
}: {
    category: Category;
    tint: string;
    colors: ThemeColors;
    currency: string;
    amount: number;
    indented?: boolean;
    onEdit: (category: Category) => void;
    onDelete: () => void;
}) {
    const t = useTranslation();
    const { language } = useLanguage();
    const size = indented ? CHILD_TILE : PARENT_TILE;
    return (
        <SwipeActions modifiers={[indented ? FLUSH_ROW : PARENT_ROW, NO_RULE]}>
            <ZStack alignment="leading">
                {indented ? <TreeConnector kind="branch" /> : null}
                {/* The elbow lands on the tile at every Dynamic Type size only because this
				    stack keeps SwiftUI's default `.center` alignment and symmetric vertical
				    padding: both put the tile's centre on the row's centre, which is where
				    the connector draws. A `firstTextBaseline` alignment is the tempting fix
				    for accessibility sizes and would pull the elbow off the tile. */}
                <HStack
                    modifiers={[
                        padding({ vertical: indented ? 3 : 4 }),
                        padding({ leading: indented ? CHILD_LEADING : ROW_LEADING }),
                        padding({ trailing: ROW_TRAILING }),
                        // A single Section leaves VoiceOver no per-parent group boundary; the
                        // heading trait hands it back.
                        ...(indented ? [] : [accessibilityAddTraits(["isHeader"])]),
                        // Without `hitArea`, the Spacer and amount gap are not
                        // hit-testable, so a row tap only lands on the label.
                        hitArea(outline.rectangle()),
                        onTapGesture(() => onEdit(category)),
                    ]}
                    spacing={indented ? 10 : 12}
                >
                    <RNHostView matchContents>
                        <View style={{ height: size, width: size }}>
                            <CategoryIconTile
                                color={tint}
                                emoji={category.emoji}
                                icon={category.icon}
                                size={size}
                                type="solid"
                            />
                        </View>
                    </RNHostView>
                    <SwiftText modifiers={[indented ? CHILD_NAME : PARENT_NAME, lineLimit(1), foregroundStyle(LABEL)]}>
                        {category.name}
                    </SwiftText>
                    <Spacer />
                    {amount > 0 ? (
                        <SwiftText modifiers={[SUBHEADLINE_MEDIUM, lineLimit(1), foregroundStyle(colors.muted)]}>
                            {formatAmount(amount, currency, false, language)}
                        </SwiftText>
                    ) : null}
                    <Image
                        color={colors.muted}
                        modifiers={[indented ? CHILD_CHEVRON : PARENT_CHEVRON]}
                        systemName="chevron.right"
                    />
                </HStack>
            </ZStack>
            <SwipeActions.Actions edge="trailing">
                {/* oxlint-disable-next-line jsx-a11y/aria-role -- @expo/ui Button `role` is a SwiftUI ButtonRole, not an ARIA role */}
                <Button label={t("common.delete")} onPress={onDelete} role="destructive" systemImage="trash" />
            </SwipeActions.Actions>
        </SwipeActions>
    );
}

function plusGlyph({ color, size }: { color: string; size: number }) {
    return <HugeiconsIcon color={color} icon={PlusSignIcon} size={size} strokeWidth={2.4} />;
}

/**
 * Owns the group's closing rule, so every boundary has a single owner: a
 * hide-bottom and a show-top request landing on the same hairline resolve inside
 * UIKit.
 */
function GhostAddRow({ tint, closesTree, onPress }: { tint: string; closesTree: boolean; onPress: () => void }) {
    const t = useTranslation();
    return (
        <ZStack
            alignment="leading"
            modifiers={[
                closesTree ? FLUSH_ROW : CLOSING_ROW,
                closesTree ? NO_RULE : listRowSeparator("visible", "bottom"),
            ]}
        >
            <TreeConnector kind="last" />
            <HStack
                modifiers={[
                    padding({ vertical: 3 }),
                    padding({ leading: CHILD_LEADING }),
                    padding({ trailing: ROW_TRAILING }),
                    hitArea(outline.rectangle()),
                    onTapGesture(onPress),
                ]}
                spacing={10}
            >
                <RNHostView matchContents>
                    <View style={{ height: CHILD_TILE, width: CHILD_TILE }}>
                        <CategoryIconTile color={tint} future glyph={plusGlyph} icon={null} size={CHILD_TILE} />
                    </View>
                </RNHostView>
                <SwiftText modifiers={[SUBHEADLINE_MEDIUM, lineLimit(1), foregroundStyle(tint)]}>
                    {t("categories.addSubcategory")}
                </SwiftText>
                <Spacer />
            </HStack>
        </ZStack>
    );
}

function SuggestedRow({
    preset,
    colors,
    onAdd,
}: {
    preset: SuggestedCategoryPreset;
    colors: ThemeColors;
    onAdd: (preset: SuggestedCategoryPreset) => void;
}) {
    return (
        <Button modifiers={[buttonStyle("plain")]} onPress={() => onAdd(preset)}>
            <HStack spacing={10}>
                <RNHostView matchContents>
                    <View style={{ height: PARENT_TILE, width: PARENT_TILE }}>
                        <CategoryIconTile
                            color={preset.color}
                            future
                            icon={preset.icon}
                            size={PARENT_TILE}
                            type="solid"
                        />
                    </View>
                </RNHostView>
                <SwiftText modifiers={[SUGGESTED_NAME, lineLimit(1), foregroundStyle(colors.muted)]}>
                    {preset.name}
                </SwiftText>
                <Spacer />
                <Image color={colors.muted} modifiers={[SUGGESTED_PLUS]} systemName="plus.circle.fill" />
            </HStack>
        </Button>
    );
}
