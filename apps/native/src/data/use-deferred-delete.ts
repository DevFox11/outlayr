import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import type { Database } from "@/db/client";
import { createDeferredDelete, type DeferredDeleteController } from "@/domain/deferred-delete";
import { translateNow } from "@/i18n/runtime";
import { transactionsRepo } from "./transactions";

const UNDO_WINDOW_MS = 4000;

interface DeferredDelete {
	/** Id currently hidden from the list while its undo window is open, or null. */
	pendingId: string | null;
	/** Hides the row now and schedules the write for after the undo window. */
	requestDelete: (id: string) => void;
	undo: () => void;
}

/**
 * The row vanishes immediately (the caller filters on `pendingId`) but the
 * soft-delete write is held for the undo window. A second delete flushes the
 * first, and unmount flushes any pending commit so it is never silently lost.
 *
 * A rejected write is reported from here rather than handed back for the screen
 * to report. Nothing was recorded and the row is on the list again, which is
 * indistinguishable from a lost gesture — and every screen that deletes this way
 * would otherwise have to remember to say so. The commit also routinely outlives
 * the screen that asked for it: an alert is a native modal and needs no render
 * tree, so it still reaches the user.
 */
export function useDeferredDelete(db: Database): DeferredDelete {
	const [pendingId, setPendingId] = useState<string | null>(null);
	const mountedRef = useRef(false);
	// Read at commit time rather than captured: the controller outlives any one
	// handle, and a delete must land in the database the screen is on now.
	const dbRef = useRef(db);
	const controllerRef = useRef<DeferredDeleteController | null>(null);

	useEffect(() => {
		dbRef.current = db;
	}, [db]);

	if (controllerRef.current === null) {
		const created = createDeferredDelete({
			commit: (id) => transactionsRepo.remove(dbRef.current, id),
			onChange: (next) => {
				if (mountedRef.current) {
					setPendingId(next.pendingId);
				}
				if (next.failedId === null) {
					return;
				}
				Alert.alert(translateNow("log.delete.failedTitle"), translateNow("log.delete.failedBody"));
				// Dropped as it is shown: the controller holds a failure until it is
				// acknowledged, so leaving it set raises the same alert again on the
				// next publish.
				created.acknowledgeFailure();
			},
			timers: {
				clear: (handle: ReturnType<typeof setTimeout>) => {
					clearTimeout(handle);
				},
				set: (run: () => void, ms: number) => setTimeout(run, ms),
			},
			windowMs: UNDO_WINDOW_MS,
		});
		controllerRef.current = created;
	}
	const controller = controllerRef.current;

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			controller.flush();
		};
	}, [controller]);

	return {
		pendingId,
		requestDelete: controller.requestDelete,
		undo: controller.undo,
	};
}
