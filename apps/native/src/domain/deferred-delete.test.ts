import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createDeferredDelete,
	type DeferredDeleteSnapshot,
} from "./deferred-delete";

const WINDOW_MS = 4000;

/** Hand-cranked: nothing scheduled runs until `elapse` is called. */
function fakeClock() {
	let nextHandle = 1;
	let nowMs = 0;
	const scheduled = new Map<number, { run: () => void; at: number }>();

	return {
		timers: {
			set: (run: () => void, ms: number) => {
				const handle = nextHandle;
				nextHandle += 1;
				scheduled.set(handle, { run, at: nowMs + ms });
				return handle;
			},
			clear: (handle: number) => {
				scheduled.delete(handle);
			},
		},
		elapse(ms: number) {
			nowMs += ms;
			for (const [handle, item] of [...scheduled]) {
				if (item.at <= nowMs) {
					scheduled.delete(handle);
					item.run();
				}
			}
		},
	};
}

/** A real macrotask, so a rejected commit's handler has certainly run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function harness(commit: (id: string) => Promise<unknown>) {
	const clock = fakeClock();
	const seen: DeferredDeleteSnapshot[] = [];
	const controller = createDeferredDelete({
		commit,
		windowMs: WINDOW_MS,
		timers: clock.timers,
		onChange: (snapshot) => {
			seen.push(snapshot);
		},
	});
	return { clock, controller, seen };
}

function recorder() {
	const committed: string[] = [];
	return {
		committed,
		commit: (id: string) => {
			committed.push(id);
			return Promise.resolve();
		},
	};
}

const rejecting = () => Promise.reject(new Error("database is locked"));

describe("createDeferredDelete", () => {
	it("hides the row now and holds the write until the window closes", () => {
		const writes = recorder();
		const { clock, controller } = harness(writes.commit);

		controller.requestDelete("a");
		assert.equal(controller.snapshot.pendingId, "a");
		assert.deepEqual(writes.committed, []);

		clock.elapse(WINDOW_MS);
		assert.deepEqual(writes.committed, ["a"]);
		assert.equal(controller.snapshot.pendingId, null);
	});

	it("drops the write entirely when the delete is taken back", () => {
		const writes = recorder();
		const { clock, controller } = harness(writes.commit);

		controller.requestDelete("a");
		controller.undo();
		clock.elapse(WINDOW_MS * 4);

		assert.deepEqual(writes.committed, []);
		assert.equal(controller.snapshot.pendingId, null);
	});

	it("commits a delete still in its window when a second one starts", () => {
		const writes = recorder();
		const { controller } = harness(writes.commit);

		controller.requestDelete("a");
		controller.requestDelete("b");

		assert.deepEqual(writes.committed, ["a"]);
		assert.equal(controller.snapshot.pendingId, "b");
	});

	/**
	 * The whole point. Nothing was written, and the caller hides the row purely by
	 * filtering on `pendingId` — so letting the window close in silence puts the
	 * row back with no explanation, which reads as a lost gesture.
	 */
	it("leaves the row visible AND reports when the write is rejected", async () => {
		const { clock, controller } = harness(rejecting);

		controller.requestDelete("a");
		clock.elapse(WINDOW_MS);
		await settle();

		assert.equal(controller.snapshot.pendingId, null);
		assert.equal(controller.snapshot.failedId, "a");
	});

	it("reports nothing when the write lands", async () => {
		const writes = recorder();
		const { clock, controller, seen } = harness(writes.commit);

		controller.requestDelete("a");
		clock.elapse(WINDOW_MS);
		await settle();

		assert.equal(controller.snapshot.failedId, null);
		assert.ok(seen.every((snapshot) => snapshot.failedId === null));
	});

	it("shows a failure once, then forgets it", async () => {
		const { clock, controller } = harness(rejecting);

		controller.requestDelete("a");
		clock.elapse(WINDOW_MS);
		await settle();
		assert.equal(controller.snapshot.failedId, "a");

		controller.acknowledgeFailure();
		assert.equal(controller.snapshot.failedId, null);
	});

	it("commits a pending delete exactly once when flushed", () => {
		const writes = recorder();
		const { clock, controller } = harness(writes.commit);

		controller.requestDelete("a");
		controller.flush();
		clock.elapse(WINDOW_MS * 4);

		assert.deepEqual(writes.committed, ["a"]);
	});

	/** Same hole, other path: the screen going away must not swallow the failure. */
	it("still reports a rejected write that was flushed", async () => {
		const { controller, seen } = harness(rejecting);

		controller.requestDelete("a");
		controller.flush();
		await settle();

		assert.equal(controller.snapshot.failedId, "a");
		assert.ok(seen.some((snapshot) => snapshot.failedId === "a"));
	});

	it("has nothing to flush once the delete was taken back", () => {
		const writes = recorder();
		const { controller } = harness(writes.commit);

		controller.requestDelete("a");
		controller.undo();
		controller.flush();

		assert.deepEqual(writes.committed, []);
	});
});
