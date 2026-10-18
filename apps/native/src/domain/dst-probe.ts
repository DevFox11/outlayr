import { text } from "node:stream/consumers";

import { buildBurndown } from "./budget-burndown";
import { budgetPace, daysLeftInWindow, hoursLeftInDay } from "./budget-math";
import { nextClockTick } from "./clock";
import { formatDayHeader } from "./dates";
import { daysBetween } from "./local-day";
import { goalProgress } from "./savings-goal";
import { reminderFireAt } from "./subscription-reminder";

const [kind = "", ...rest] = process.argv.slice(2);
const parts = rest.map(Number);

const localDate = (offset: number): Date =>
    new Date(
        parts[offset] ?? 0,
        parts[offset + 1] ?? 0,
        parts[offset + 2] ?? 1,
        parts[offset + 3] ?? 0,
        parts[offset + 4] ?? 0
    );

const wallTime = (d: Date) => [d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];

async function answer(): Promise<string> {
    switch (kind) {
        case "header": {
            return formatDayHeader(localDate(0), localDate(5), "en");
        }
        case "days": {
            return String(daysLeftInWindow({ end: localDate(0), start: localDate(5) }, localDate(10)));
        }
        case "hours": {
            return String(hoursLeftInDay({ end: localDate(0), start: localDate(5) }, localDate(10)));
        }
        case "pace": {
            return String(budgetPace({ end: localDate(0), start: localDate(5) }, localDate(10)).remaining);
        }
        case "days-between": {
            return String(daysBetween(localDate(0).getTime(), localDate(5).getTime()));
        }
        case "goal-elapsed": {
            const span = { startAmount: 0, startDate: localDate(0), targetDate: localDate(5) };
            return String(goalProgress(0, 100, { ...span, now: localDate(10) }).standing?.elapsed);
        }
        case "burndown": {
            const rows = [
                { amount: 10, categoryId: null, date: localDate(0), parentId: null },
                { amount: 20, categoryId: null, date: localDate(15), parentId: null },
            ];
            const window = { end: localDate(5), start: localDate(0) };
            return JSON.stringify(
                buildBurndown(rows, { limit: 100, now: localDate(10), window }).points.map((p) => p.spent)
            );
        }
        case "clock": {
            const dateArgs: [number, number, number, number][] = JSON.parse(await text(process.stdin));
            const ticks = dateArgs.map(([year, month, day, hour]) => {
                const nowMs = new Date(year, month, day, hour).getTime();
                const tick = nextClockTick(nowMs);
                return { arrival: wallTime(new Date(nowMs + tick)), offset: new Date(nowMs).getTimezoneOffset(), tick };
            });
            return JSON.stringify(ticks);
        }
        case "reminder": {
            const [[ly, lm, ld], [ey, em, ed]]: [[number, number, number], [number, number, number]] = JSON.parse(
                rest[0] ?? "[]"
            );
            const landing = new Date(ly, lm, ld);
            const earlier = new Date(ey, em, ed);
            const fire = reminderFireAt(landing, 7, { hour: 9, minute: 0 });
            return JSON.stringify({
                earlierOffset: earlier.getTimezoneOffset(),
                fire: [
                    fire.getFullYear(),
                    fire.getMonth() + 1,
                    fire.getDate(),
                    fire.getHours(),
                    fire.getMinutes(),
                    fire.getSeconds(),
                ],
                landingOffset: landing.getTimezoneOffset(),
            });
        }
        default: {
            throw new Error(`unknown probe: ${kind}`);
        }
    }
}

void answer().then((out) => process.stdout.write(out));
