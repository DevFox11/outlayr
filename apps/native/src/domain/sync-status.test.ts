import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syncStatusLabel } from "./sync-status";

const AT = new Date(1_700_000_000_000);

describe("syncStatusLabel", () => {
	it("reads an empty queue as up to date, not as zero pending", () => {
		assert.deepEqual(syncStatusLabel(0, AT), { key: "settings.sync.upToDate" });
	});

	it("does not claim up to date on a device that has never synced", () => {
		assert.deepEqual(syncStatusLabel(0, null), { key: "settings.sync.never" });
	});

	it("counts a single pending row without pluralising it", () => {
		assert.deepEqual(syncStatusLabel(1, AT), {
			key: "settings.sync.pendingOne",
		});
	});

	it("carries the count once there is more than one", () => {
		assert.deepEqual(syncStatusLabel(7, AT), {
			key: "settings.sync.pending",
			count: 7,
		});
	});

	it("reports pending work even before a first successful cycle", () => {
		assert.deepEqual(syncStatusLabel(3, null), {
			key: "settings.sync.pending",
			count: 3,
		});
	});
});
