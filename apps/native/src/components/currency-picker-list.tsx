import { LegendList } from "@legendapp/list/react-native";
import type { LegendListRef } from "@legendapp/list/react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import type { HostInstance, StyleProp, ViewInstance, ViewStyle } from "react-native";
import Animated, {
    Easing,
    FadeIn,
    ReduceMotion,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { currencyPickerRows } from "@/domain/currency-picker-rows";
import type { CurrencyCode, CurrencyPickerRow } from "@/domain/currency-picker-rows";
import { FAVOURITE_CURRENCY_LIMIT } from "@/domain/favourite-currencies";

import { CurrencyHint, CurrencyRow, CurrencyRowCopy, CurrencySectionHeader } from "./currency-picker-row";

const EASE = Easing.bezier(0.645, 0.045, 0.355, 1);

/**
 * One fade over the whole list, keyed on the query — not an entering animation
 * per row. A per-row fade would also fire on every row scrolling into the
 * virtualised window, and this screen just had a per-keystroke stall removed.
 */
const RESULTS_SETTLE = FadeIn.duration(180).easing(EASE.factory()).reduceMotion(ReduceMotion.System);

/** Ease-in-out, because the row is on screen at both ends of the journey. */
const TRAVEL = {
    duration: 260,
    easing: EASE,
    reduceMotion: ReduceMotion.System,
} as const;

/**
 * A toggle the cap refuses never changes `favourites`, so the landing that ends
 * a travel would never arrive. Releases the copy rather than stranding it over
 * a row it is holding back.
 */
const TRAVEL_ABANDON_MS = 700;

/** Where a row was standing when it was favourited, in the wrapper's space. */
interface Travel {
    code: CurrencyCode;
    /** The rows it left. The landing is measured when these are replaced. */
    departed: readonly CurrencyPickerRow[];
    height: number;
    left: number;
    selected: boolean;
    top: number;
    width: number;
    wrapperTop: number;
}

interface CurrencyPickerListProps {
    /** The sheet needs its own padding; the settings screen takes the default. */
    contentContainerStyle?: StyleProp<ViewStyle>;
    favourites: readonly string[];
    onSelect: (code: string) => void;
    /** `null` while no database is open, so favouriting is absent rather than dead. */
    onToggleFavourite: ((code: string, favourite: boolean) => void) | null;
    query: string;
    selected: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * A virtualised list, not `@expo/ui`'s SwiftUI `List`.
 *
 * The SwiftUI one is not virtualised at all — it mounts every child it is given,
 * which for 165 currencies was one ~550ms commit that nothing could paint around.
 * That showed up as 1.75s of dead screen after tapping Settings › Currency, a
 * stall on every keystroke, and a second stall on clearing the search, when the
 * list grows back from a few matches to the whole catalogue.
 *
 * Favouriting moves a row between the two sections. Legend List positions its
 * recycled containers absolutely and offers no item layout animation, so a
 * `layout` prop on the row has nothing to animate — the container moves and the
 * row inside it does not. The journey is drawn instead by measuring where the
 * row stood, measuring where it landed, and flying one copy above the list
 * between the two. When the landing is outside the visible range there is
 * nothing to fly to, and the row moves at once as it always did.
 */
export function CurrencyPickerList({
    favourites,
    query,
    selected,
    onSelect,
    onToggleFavourite,
    style,
    contentContainerStyle,
}: CurrencyPickerListProps) {
    const rows = useMemo<readonly CurrencyPickerRow[]>(
        () => currencyPickerRows(favourites, query),
        [favourites, query]
    );

    const full = favourites.length >= FAVOURITE_CURRENCY_LIMIT;

    const listRef = useRef<LegendListRef>(null);
    const wrapperRef = useRef<ViewInstance>(null);
    const [travel, setTravel] = useState<Travel | null>(null);
    const travelled = useSharedValue(0);

    const travelStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: travelled.value }],
    }));

    // Legend List keeps a ref to the container holding each rendered row, so the
    // row itself needs no ref of its own — nothing here costs anything per row.
    // It types those refs as `any`, and returns nothing for an unrendered index.
    const containerAt = (index: number): HostInstance | undefined => listRef.current?.getState().elementAtIndex(index);

    const lift = (code: CurrencyCode) => {
        const wrapper = wrapperRef.current;
        const container = containerAt(rows.findIndex((row) => row.key === code));
        if (wrapper === null || !container) {
            return;
        }
        wrapper.measureInWindow((wrapperLeft, wrapperTop) => {
            container.measureInWindow((left, top, width, height) => {
                travelled.value = 0;
                setTravel({
                    code,
                    departed: rows,
                    height,
                    left: left - wrapperLeft,
                    selected: code === selected,
                    top: top - wrapperTop,
                    width,
                    wrapperTop,
                });
            });
        });
    };

    useEffect(() => {
        if (travel === null) {
            return;
        }
        const abandon = setTimeout(() => setTravel(null), TRAVEL_ABANDON_MS);
        return () => clearTimeout(abandon);
    }, [travel]);

    useEffect(() => {
        if (travel === null || rows === travel.departed) {
            return;
        }
        // A frame after the commit, so the containers have taken their new places.
        const frame = requestAnimationFrame(() => {
            const state = listRef.current?.getState();
            const index = rows.findIndex((row) => row.key === travel.code);
            // Legend List's own visible range: outside it there is nothing to fly to.
            if (state === undefined || index < state.start || index > state.end) {
                setTravel(null);
                return;
            }
            const container: HostInstance | undefined = state.elementAtIndex(index);
            if (!container) {
                setTravel(null);
                return;
            }
            container.measureInWindow((_left, top) => {
                travelled.value = withTiming(top - travel.wrapperTop - travel.top, TRAVEL, (finished) => {
                    if (finished) {
                        runOnJS(setTravel)(null);
                    }
                });
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [rows, travel, travelled]);

    const toggleFavourite =
        onToggleFavourite === null
            ? null
            : (code: CurrencyCode, favourite: boolean) => {
                  // A search returns one flat list, so the row keeps its place and has
                  // no journey to draw.
                  if (query.trim() === "") {
                      lift(code);
                  }
                  onToggleFavourite(code, favourite);
              };

    return (
        <View className="bg-background flex-1" ref={wrapperRef} style={style}>
            <Animated.View className="flex-1" entering={RESULTS_SETTLE} key={query}>
                <LegendList
                    contentContainerStyle={contentContainerStyle}
                    contentInsetAdjustmentBehavior="automatic"
                    // SAFETY: `rows` is this component's own prop, already narrowed by the
                    // caller; Legend List widens its `data` generic on the way in.
                    data={rows as CurrencyPickerRow[]}
                    // A container re-renders on its own item or on `extraData`, never
                    // because the list around it did. Without this the row that took off
                    // is never told the copy has landed, and stays held back for good.
                    extraData={travel?.code}
                    // Three pools. A header, the one-off hint and a currency row share no
                    // layout, and recycling across them is what makes a mixed list stutter.
                    getItemType={(row: CurrencyPickerRow) => row.kind}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    keyExtractor={(row: CurrencyPickerRow) => row.key}
                    // A copy in flight is pinned to where the list stood when it took off.
                    onScroll={travel === null ? undefined : () => setTravel(null)}
                    // `ReanimatedSwipeable` keeps its open/closed offset inside the row
                    // instance, so a recycled row would inherit the previous row's swipe.
                    recycleItems={false}
                    ref={listRef}
                    renderItem={({ item: row }: { item: CurrencyPickerRow }) => {
                        if (row.kind === "header") {
                            return <CurrencySectionHeader section={row.section} />;
                        }
                        if (row.kind === "hint") {
                            return <CurrencyHint />;
                        }
                        return (
                            <CurrencyRow
                                code={row.code}
                                favourite={row.favourite}
                                full={full}
                                last={row.last}
                                onPress={() => onSelect(row.code)}
                                onToggleFavourite={
                                    toggleFavourite === null ? null : () => toggleFavourite(row.code, row.favourite)
                                }
                                selected={row.code === selected}
                                travelling={row.code === travel?.code}
                            />
                        );
                    }}
                />
            </Animated.View>
            {travel === null ? null : (
                <Animated.View
                    className="absolute"
                    pointerEvents="none"
                    style={[
                        {
                            height: travel.height,
                            left: travel.left,
                            top: travel.top,
                            width: travel.width,
                        },
                        travelStyle,
                    ]}
                >
                    <CurrencyRowCopy code={travel.code} selected={travel.selected} />
                </Animated.View>
            )}
        </View>
    );
}
