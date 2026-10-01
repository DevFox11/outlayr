import { View } from "react-native";

import type { TransferEnd, TransferLogRow } from "@/domain/transfer-log-rows";
import { useColors } from "@/theme/use-colors";

import { CategoryIconTile } from "./category-icon-tile";

/** A 20pt glyph in 8pt of padding. */
export const TILE_SIZE = 36;
export const TILE_RADIUS = 9;

export const BADGE_OFFSET = -5;
const BADGE_SIZE = 20;
const BADGE_RADIUS = 6;
const BADGE_RING = 2;

function AccountTile({
    end,
    future,
    radius,
    size,
}: {
    end: TransferEnd;
    future: boolean;
    radius: number;
    size: number;
}) {
    const colors = useColors();
    return (
        <CategoryIconTile
            color={end.imageColor ?? end.customColor ?? colors.foreground}
            emoji={end.emoji}
            future={future}
            icon={end.icon}
            imageUri={end.imageUri}
            radius={radius}
            size={size}
            type="solid"
        />
    );
}

export function TransferTile({ ends, future }: { ends: NonNullable<TransferLogRow["ends"]>; future: boolean }) {
    return (
        <View>
            <AccountTile end={ends.from} future={future} radius={TILE_RADIUS} size={TILE_SIZE} />
            <View
                className="bg-background absolute"
                style={{
                    borderRadius: BADGE_RADIUS + BADGE_RING,
                    bottom: BADGE_OFFSET - BADGE_RING,
                    padding: BADGE_RING,
                    right: BADGE_OFFSET - BADGE_RING,
                }}
            >
                <AccountTile end={ends.to} future={future} radius={BADGE_RADIUS} size={BADGE_SIZE} />
            </View>
        </View>
    );
}
