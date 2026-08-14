export const MARK_MOTION = {
    arrive: { delay: 350, distance: 46, duration: 1150 },
    fade: { duration: 500 },
    recede: { duration: 850, stagger: 60 },
    settle: { delay: 500, duration: 750, scale: 1.08 },
    stagger: 90,
} as const;

const OPACITY_LEAD = 3;

const clamp01 = (value: number) => {
    "worklet";
    return Math.min(1, Math.max(0, value));
};

export interface ArrivalFrame {
    opacity: number;
    translateY: number;
}

export function arrivalFrame(progress: number, distance: number): ArrivalFrame {
    "worklet";
    const settled = clamp01(progress);
    return {
        opacity: clamp01(settled * OPACITY_LEAD),
        translateY: (1 - settled) * distance,
    };
}

export function settleFrame(progress: number, from: number) {
    "worklet";
    const settled = clamp01(progress);
    return {
        opacity: clamp01(settled * OPACITY_LEAD),
        scale: from + (1 - from) * settled,
    };
}

export function recedeDelay(index: number): number {
    return Math.max(0, index) * MARK_MOTION.recede.stagger;
}

export function staggerDelay(index: number): number {
    return Math.max(0, index) * MARK_MOTION.stagger;
}
