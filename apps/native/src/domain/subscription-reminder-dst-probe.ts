import { reminderFireAt } from "./subscription-reminder";

/**
 * Runs outside the test process, spawned with `TZ` forced by the caller. Jest
 * caches the host's own zone the first time any `Date` is touched, and a
 * later `process.env.TZ` mutation inside the test process is silently
 * ignored — only a fresh process picks up a different zone.
 */
interface ProbeResult {
	earlierOffset: number;
	fire: [number, number, number, number, number, number];
	landingOffset: number;
}

const [[landingYear, landingMonth, landingDay], [earlierYear, earlierMonth, earlierDay]]: [
	[number, number, number],
	[number, number, number],
] = JSON.parse(process.argv[2] ?? "[]");

const landing = new Date(landingYear, landingMonth, landingDay);
const earlier = new Date(earlierYear, earlierMonth, earlierDay);
const fire = reminderFireAt(landing, 7, { hour: 9, minute: 0 });

const result: ProbeResult = {
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
};

process.stdout.write(JSON.stringify(result));
