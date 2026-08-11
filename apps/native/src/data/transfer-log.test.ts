import type { LogFilter } from "@/domain/log-filter";
import { logTransferBounds, type TransferScope } from "./transfer-log";

const MID_MARCH = new Date(2026, 2, 18, 15, 30);
const FEB_1 = new Date(2026, 1, 1);
const MARCH_1 = new Date(2026, 2, 1);
const APRIL_1 = new Date(2026, 3, 1);

function scope(filter: LogFilter, overrides: Partial<TransferScope> = {}): TransferScope {
	return {
		cursor: MID_MARCH,
		filter,
		firstWeekday: 1,
		page: { floor: FEB_1, reachedEnd: false },
		...overrides,
	};
}

describe("logTransferBounds", () => {
	it("holds the unfiltered list's transfers to the days it has actually loaded", () => {
		const bounds = logTransferBounds(scope("all"));

		expect(bounds?.since).toStrictEqual(FEB_1);
		expect(bounds?.until).toBeNull();
	});

	it("reaches back past that floor once the list has loaded every day there is", () => {
		const bounds = logTransferBounds(scope("all", { page: { floor: FEB_1, reachedEnd: true } }));

		expect(bounds?.since).toBeNull();
	});

	it("reaches back past that floor when the list has loaded nothing to bound it with", () => {
		const bounds = logTransferBounds(scope("all", { page: { floor: null, reachedEnd: false } }));

		expect(bounds?.since).toBeNull();
	});

	it("holds a month filter to the month its cursor names", () => {
		const bounds = logTransferBounds(scope("month"));

		expect(bounds?.since).toStrictEqual(MARCH_1);
		expect(bounds?.until).toStrictEqual(APRIL_1);
	});

	it("holds a day filter to that one day", () => {
		const bounds = logTransferBounds(scope("day"));

		expect(bounds?.since).toStrictEqual(new Date(2026, 2, 18));
		expect(bounds?.until).toStrictEqual(new Date(2026, 2, 19));
	});

	it("holds a week filter to the week its cursor names, on the weekday the owner starts on", () => {
		const sunday = logTransferBounds(scope("week", { firstWeekday: 1 }));
		const monday = logTransferBounds(scope("week", { firstWeekday: 2 }));

		expect(sunday?.since).toStrictEqual(new Date(2026, 2, 15));
		expect(sunday?.until).toStrictEqual(new Date(2026, 2, 22));
		expect(monday?.since).toStrictEqual(new Date(2026, 2, 16));
		expect(monday?.until).toStrictEqual(new Date(2026, 2, 23));
	});

	// The screen seeds each cursor with the raw clock and only normalizes on a
	// step, so the first render of a period filter hands this an afternoon.
	it("normalizes a cursor that still carries a time of day", () => {
		const bounds = logTransferBounds(scope("month", { cursor: new Date(2026, 2, 31, 23, 59, 59) }));

		expect(bounds?.since).toStrictEqual(MARCH_1);
		expect(bounds?.until).toStrictEqual(APRIL_1);
	});

	it.each<LogFilter>(["category", "type", "recurring", "upcoming"])(
		"admits no transfer to the %s filter, which a transfer answers nothing about",
		(filter) => {
			expect(logTransferBounds(scope(filter))).toBeNull();
		}
	);

	/** A transfer synced from another timezone carries a `day` that is not the local
	 * midnight of its `date`. Bounding a period on `day` would then put it in a
	 * different month from a transaction recorded at the same instant. */
	it("measures a period against the same column the transactions beside it use", () => {
		for (const filter of ["week", "month"] as LogFilter[]) {
			expect(logTransferBounds(scope(filter))?.floorOn).toBe("date");
		}
	});

	it("pages the window on the day it was floored at, as the window itself is", () => {
		expect(logTransferBounds(scope("all"))?.floorOn).toBe("day");
	});

	it("leaves the transfers tab every transfer ever recorded", () => {
		expect(logTransferBounds(scope("transfers"))).toStrictEqual({ floorOn: "day", since: null, until: null });
	});
});
