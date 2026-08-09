import { syncStatusLabel } from "./sync-status";

const AT = new Date(1_700_000_000_000);

describe("syncStatusLabel", () => {
	it("reads an empty queue as up to date, not as zero pending", () => {
		expect(syncStatusLabel(0, AT)).toStrictEqual({
			key: "settings.sync.upToDate",
		});
	});

	it("does not claim up to date on a device that has never synced", () => {
		expect(syncStatusLabel(0, null)).toStrictEqual({
			key: "settings.sync.never",
		});
	});

	it("counts a single pending row without pluralising it", () => {
		expect(syncStatusLabel(1, AT)).toStrictEqual({
			key: "settings.sync.pendingOne",
		});
	});

	it("carries the count once there is more than one", () => {
		expect(syncStatusLabel(7, AT)).toStrictEqual({
			count: 7,
			key: "settings.sync.pending",
		});
	});

	it("reports pending work even before a first successful cycle", () => {
		expect(syncStatusLabel(3, null)).toStrictEqual({
			count: 3,
			key: "settings.sync.pending",
		});
	});
});
