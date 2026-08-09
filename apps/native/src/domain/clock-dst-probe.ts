import { nextClockTick } from "./clock";

/**
 * Runs outside the test process, spawned with `TZ` forced by the caller. Jest
 * caches the host's own zone the first time any `Date` is touched, and a
 * later `process.env.TZ` mutation inside the test process is silently
 * ignored — only a fresh process picks up a different zone.
 */
interface ProbeResult {
	arrival: [number, number, number, number];
	offset: number;
	tick: number;
}

function wallTime(ms: number): [number, number, number, number] {
	const d = new Date(ms);
	return [d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];
}

const dateArgs: [number, number, number, number][] = JSON.parse(process.argv[2] ?? "[]");

const results: ProbeResult[] = dateArgs.map(([year, month, day, hour]) => {
	const nowMs = new Date(year, month, day, hour).getTime();
	const tick = nextClockTick(nowMs);
	return {
		arrival: wallTime(nowMs + tick),
		offset: new Date(nowMs).getTimezoneOffset(),
		tick,
	};
});

process.stdout.write(JSON.stringify(results));
