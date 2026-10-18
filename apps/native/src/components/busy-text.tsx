import { Shimmer } from "panelui-native/components/shimmer";

import { withAlpha } from "@/theme/shade";

const SWEEP_MS = 1800;
const REST_ALPHA = 0.55;

export function BusyText({ children, className, color }: { children: string; className?: string; color: string }) {
    return (
        <Shimmer
            as="text"
            baseColor={withAlpha(color, REST_ALPHA)}
            duration={SWEEP_MS}
            shimmerColor={color}
            textClassName={className}
        >
            {children}
        </Shimmer>
    );
}
