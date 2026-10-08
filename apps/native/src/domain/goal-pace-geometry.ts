import { startOfLocalDay } from "./local-day";

/**
 * The pace chart's geometry, kept apart from the canvas that draws it.
 *
 * Pure arithmetic, so it can be tested without Skia — the head has been anchored
 * to the wrong point once already, and that failure is a mark a few pixels along
 * rather than a crash.
 */

/** A point on either line: a moment, and what was held or wanted at it. */
export interface GoalLinePoint {
    time: number;
    value: number;
}

const PAD = { bottom: 10, left: 4, right: 4, top: 10 } as const;

export interface GeometryInput {
    actual: readonly GoalLinePoint[];
    height: number;
    nowMs: number;
    required: readonly GoalLinePoint[];
    startTime: number;
    target: number;
    targetTime: number;
    width: number;
}

/**
 * The money axis always contains the target and both lines, so the plot is the
 * whole decision rather than a crop of it. The time axis is the goal's own span:
 * a goal is only ever read against its own deadline.
 *
 * Exported for its test: the head has been anchored to the wrong point once
 * already, and the failure is a mark a few pixels along rather than a crash.
 */
export function makeGeometry({ actual, height, nowMs, required, startTime, target, targetTime, width }: GeometryInput) {
    // The deadline keeps whatever time of day the goal was created at, while
    // `standingFor` and the required line treat it as a local midnight. Only the
    // "is there still a future to draw" question is cut that way — the point
    // filter below stays on real instants, since the series is stamped in them.
    const overdue = startOfLocalDay(nowMs) >= startOfLocalDay(targetTime);
    const span = Math.max(1, targetTime - startTime);
    // Everything below draws from the settled points only. A future-dated
    // transaction would otherwise be drawn as observed history AND stretch the
    // value axis to reach a balance the account does not hold, compressing the
    // gap at today — the one distance the chart exists to show.
    const banked = actual.filter((point) => point.time <= nowMs);
    const values = [target, ...required.map((point) => point.value), ...banked.map((point) => point.value)];
    const rawTop = Math.max(...values);
    const rawBottom = Math.min(...values);
    const range = Math.max(1, rawTop - rawBottom);

    const plotLeft = PAD.left;
    const plotRight = width - PAD.right;
    const plotTop = PAD.top;
    const plotHeight = height - PAD.top - PAD.bottom;

    const x = (time: number) => plotLeft + Math.min(1, Math.max(0, (time - startTime) / span)) * (plotRight - plotLeft);
    const y = (value: number) =>
        plotTop + ((rawTop - Math.min(rawTop, Math.max(rawBottom, value))) / range) * plotHeight;

    const line = (points: readonly GoalLinePoint[]) =>
        points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.time)} ${y(point.value)}`).join(" ");

    // At the point's own timestamp — the start of the current UTC day — because
    // that is the instant `standingFor` measures at too. Both were briefly on
    // different footings, which drew a gap kinder than the verdict printed beside
    // it; they are pinned together on whole days now, which is the granularity the
    // series, the pace and the months left all already use.
    const last = banked.at(-1);
    const head = last ? { x: x(last.time), y: y(last.value) } : null;

    // From where the account stands TODAY to the target, which is what "keep this
    // pace and you land here" means — deliberately the same dash the budget chart
    // uses for a projection.
    //
    // Nothing is projected once the balance has met the target: the line would run
    // DOWN to it, reading as a plan to withdraw the surplus, next to a verdict
    // saying the goal is done. There is no pace left to keep.
    // Nor once the deadline is behind: both ends clamp to the axis's right edge,
    // so the dash collapses into a vertical stroke at the border, drawing a future
    // path beside a pace correctly saying the whole remainder is due now.
    const projectable = head !== null && (last?.value ?? 0) < target && !overdue;
    const projection = projectable ? `M ${head.x} ${head.y} L ${x(targetTime)} ${y(target)}` : null;

    return {
        actual: banked.length > 1 ? line(banked) : null,
        axis: `M ${plotLeft} ${y(rawBottom)} L ${plotRight} ${y(rawBottom)}`,
        goal: { x: x(targetTime), y: y(target) },
        head: head && nowMs >= startTime ? head : null,
        projection,
        required: line(required),
    };
}
