import { useCallback, useEffect, useRef, useState } from "react";
import type { Database } from "@/db/client";
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
 */
export function useDeferredDelete(db: Database): DeferredDelete {
	const [pendingId, setPendingId] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingRef = useRef<string | null>(null);

	const commit = useCallback(
		(id: string) => {
			transactionsRepo.remove(db, id).catch((error) => {
				console.error("Deferred delete commit failed", error);
			});
		},
		[db],
	);

	const clearTimer = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const requestDelete = useCallback(
		(id: string) => {
			// A pending delete already in flight commits immediately before the new one.
			if (pendingRef.current && pendingRef.current !== id) {
				commit(pendingRef.current);
			}
			clearTimer();
			pendingRef.current = id;
			setPendingId(id);
			timerRef.current = setTimeout(() => {
				commit(id);
				pendingRef.current = null;
				setPendingId(null);
				timerRef.current = null;
			}, UNDO_WINDOW_MS);
		},
		[clearTimer, commit],
	);

	const undo = useCallback(() => {
		clearTimer();
		pendingRef.current = null;
		setPendingId(null);
	}, [clearTimer]);

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			if (pendingRef.current) {
				commit(pendingRef.current);
			}
		};
	}, [commit]);

	return { pendingId, requestDelete, undo };
}
