import { budgetPace, daysLeftInWindow, hoursLeftInDay } from "./budget-math";
import { nextClockTick } from "./clock";
import { formatDayHeader } from "./dates";
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

function answer(): string {
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
        case "clock": {
            const dateArgs: [number, number, number, number][] = JSON.parse(rest[0] ?? "[]");
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

process.stdout.write(answer());
