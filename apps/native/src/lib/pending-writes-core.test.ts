import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	adoptQueue,
	claimPendingWrites,
	type PendingWrite,
	parseLegacyQueue,
	parseQueue,
	QUEUE_FILE,
	type QueueFiles,
	releasePendingWrites,
} from "./pending-writes-core";

function write(
	id: string,
	overrides: Partial<PendingWrite> = {},
): PendingWrite {
	return {
		id,
		amount: 12.4,
		income: false,
		note: "Bakery",
		category: null,
		date: 1_700_000_000_000,
		...overrides,
	};
}

/** An in-memory stand-in for the App Group directory. */
function makeFiles(initial: Record<string, string> = {}) {
	const disk = new Map(Object.entries(initial));
	const files: QueueFiles = {
		list: () => [...disk.keys()],
		claim(name) {
			const live = disk.get(QUEUE_FILE);
			if (live == null || live === "") {
				return false;
			}
			disk.set(name, live);
			disk.delete(QUEUE_FILE);
			return true;
		},
		read: (name) => disk.get(name) ?? "",
		write: (name, text) => {
			disk.set(name, text);
		},
		discard: (name) => {
			disk.delete(name);
		},
	};
	return { disk, files };
}

function lines(...jobs: PendingWrite[]): string {
	return `${jobs.map((job) => JSON.stringify(job)).join("\n")}\n`;
}

describe("parseQueue", () => {
	it("skips a partial last line rather than losing the whole file", () => {
		const good = write("a");
		const text = `${lines(good)}{"id":"b","amount":3`;

		assert.deepEqual(
			parseQueue(text).map((job) => job.id),
			["a"],
		);
	});

	it("rejects a line that is JSON but not a write", () => {
		assert.deepEqual(parseQueue('{"id":"a"}\nnull\n[]'), []);
	});

	it("keeps the order the lines were appended in", () => {
		const text = lines(write("a"), write("b"), write("c"));

		assert.deepEqual(
			parseQueue(text).map((job) => job.id),
			["a", "b", "c"],
		);
	});
});

describe("claimPendingWrites", () => {
	it("moves the live queue aside so a concurrent append is not lost", () => {
		const { disk, files } = makeFiles({ [QUEUE_FILE]: lines(write("a")) });

		const claimed = claimPendingWrites(files);

		assert.deepEqual(claimed.names, ["claimed-1.jsonl"]);
		assert.equal(disk.has(QUEUE_FILE), false);
		assert.deepEqual(
			claimed.jobs.map((job) => job.id),
			["a"],
		);
	});

	it("replays what an interrupted drain claimed and never released", () => {
		const { files } = makeFiles({
			"claimed-1.jsonl": lines(write("a")),
			[QUEUE_FILE]: lines(write("b")),
		});

		const claimed = claimPendingWrites(files);

		assert.deepEqual(claimed.names, ["claimed-1.jsonl", "claimed-2.jsonl"]);
		assert.deepEqual(
			claimed.jobs.map((job) => job.id),
			["a", "b"],
		);
	});

	it("orders leftovers oldest first past a single digit", () => {
		const { files } = makeFiles({
			"claimed-10.jsonl": lines(write("j")),
			"claimed-2.jsonl": lines(write("b")),
		});

		const claimed = claimPendingWrites(files);

		assert.deepEqual(
			claimed.jobs.map((job) => job.id),
			["b", "j"],
		);
		assert.deepEqual(claimed.names, ["claimed-2.jsonl", "claimed-10.jsonl"]);
	});

	it("claims nothing when the queue is empty", () => {
		const { files } = makeFiles();

		assert.deepEqual(claimPendingWrites(files), { names: [], jobs: [] });
	});

	it("leaves the claim in place until it is released", () => {
		const { disk, files } = makeFiles({ [QUEUE_FILE]: lines(write("a")) });

		const claimed = claimPendingWrites(files);
		assert.equal(disk.has("claimed-1.jsonl"), true);

		releasePendingWrites(files, claimed);
		assert.deepEqual([...disk.keys()], []);
	});
});

describe("adoptQueue", () => {
	it("parks the pre-file queue ahead of anything appended since", () => {
		const { files } = makeFiles({ [QUEUE_FILE]: lines(write("new")) });

		adoptQueue(files, parseLegacyQueue(JSON.stringify([write("old")])));
		const claimed = claimPendingWrites(files);

		assert.deepEqual(
			claimed.jobs.map((job) => job.id),
			["old", "new"],
		);
	});

	it("writes nothing when the old key held no usable writes", () => {
		const { disk, files } = makeFiles();

		adoptQueue(files, parseLegacyQueue("not json"));

		assert.deepEqual([...disk.keys()], []);
	});
});
