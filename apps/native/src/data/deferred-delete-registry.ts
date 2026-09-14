import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { mainBudget } from "@/db/schema";
import { createDeferredDelete } from "@/domain/deferred-delete";
import type { DeferredDeleteController } from "@/domain/deferred-delete";
import type { TranslatableKey } from "@/i18n/catalog";
import { translateNow } from "@/i18n/runtime";
import { dismissNotice, notifyFailure, notifyUndoable } from "@/lib/notify";

import { accountsRepo } from "./accounts-core";
import { budgetsRepo } from "./budgets-core";
import { categoriesRepo } from "./categories-core";
import { savingsGoalsRepo } from "./savings-goals-core";
import { transactionsRepo } from "./transactions-core";
import { transfersRepo } from "./transfers-core";

/**
 * The undo has to be noticed and reached for before the write lands, so the
 * window is sized to the toast that offers it rather than the other way round.
 */
export const UNDO_WINDOW_MS = 10_000;

/**
 * What a held write acts on. `recurring` is not a delete — it ends a schedule —
 * but it is destructive, irreversible once written, and wants the same window,
 * so it rides the same machinery.
 */
export type DeferredDeleteKind = "account" | "budget" | "category" | "goal" | "recurring" | "row";

interface KindSpec {
    commit: (db: Database, id: string) => Promise<void>;
    failedBody: TranslatableKey;
    failedTitle: TranslatableKey;
    /** Titles the toast that carries the undo. */
    undoTitle: TranslatableKey;
}

/**
 * Which table a row id belongs to is read at commit time rather than passed in:
 * a caller deriving it from its own list gets it wrong the moment that list is
 * filtered inside the undo window, and removing a transfer as a transaction
 * updates zero rows and rejects nothing.
 */
async function commitRow(db: Database, id: string): Promise<void> {
    const transfer = await transfersRepo.getById(db, id);
    await (transfer ? transfersRepo.softDelete(db, id) : transactionsRepo.remove(db, id));
}

/** The overall budget lives in its own table, and only its id can say so. */
async function commitBudget(db: Database, id: string): Promise<void> {
    const [overall] = await db.select({ id: mainBudget.id }).from(mainBudget).where(eq(mainBudget.id, id));
    await (overall ? budgetsRepo.deleteMainBudget(db, id) : budgetsRepo.deleteBudget(db, id));
}

const SPECS = {
    account: {
        commit: (db, id) => accountsRepo.softDelete(db, id),
        failedBody: "accounts.error.generic",
        failedTitle: "accounts.error.deleteTitle",
        undoTitle: "accounts.undo.deleted",
    },
    budget: {
        commit: commitBudget,
        failedBody: "budgets.delete.failedBody",
        failedTitle: "budgets.delete.failedTitle",
        undoTitle: "budgets.undo.deleted",
    },
    category: {
        commit: (db, id) => categoriesRepo.remove(db, id),
        failedBody: "categories.error.generic",
        failedTitle: "categories.error.deleteTitle",
        undoTitle: "categories.undo.deleted",
    },
    goal: {
        commit: (db, id) => savingsGoalsRepo.remove(db, id),
        failedBody: "goals.failedBody",
        failedTitle: "goals.failedTitle",
        undoTitle: "goals.undo.deleted",
    },
    recurring: {
        commit: (db, id) => transactionsRepo.stopRecurring(db, id),
        failedBody: "transaction.stopRecurring.failedBody",
        failedTitle: "transaction.stopRecurring.failedTitle",
        undoTitle: "transaction.stopRecurring.stopped",
    },
    row: {
        commit: commitRow,
        failedBody: "log.delete.failedBody",
        failedTitle: "log.delete.failedTitle",
        undoTitle: "log.undo.deleted",
    },
} satisfies Record<DeferredDeleteKind, KindSpec>;

export interface DeferredDeleteRegistry {
    /** Points every held write at the open database; re-set when the file is reopened. */
    attachDatabase: (db: Database | null) => void;
    /** Commits every open window now, e.g. because the app is leaving the foreground. */
    flushAll: () => Promise<void>;
    /** Id currently held for `kind`, which its list hides, or null. */
    pendingId: (kind: DeferredDeleteKind) => string | null;
    /** `body` is an already-translated supporting line for the undo toast. */
    requestDelete: (kind: DeferredDeleteKind, id: string, body?: string) => void;
    subscribe: (kind: DeferredDeleteKind, listener: () => void) => () => void;
}

interface Slot {
    controller: DeferredDeleteController;
    listeners: Set<() => void>;
    setBody: (next: string | undefined) => void;
}

/**
 * One held-write controller per entity kind, with the undo offer and the failure
 * report attached to each.
 *
 * Both toasts are raised from here rather than handed back for the screen to
 * report. Every screen that deletes this way pairs them identically, and a
 * failure means nothing was recorded and the row is on the list again —
 * indistinguishable from a lost gesture unless it is said.
 *
 * Nothing here is React, and deliberately so: the window routinely outlives the
 * screen that opened it. A delete from a detail screen navigates straight back,
 * and a controller owned by that screen would flush on the way out, leaving no
 * window at all.
 */
export function createDeferredDeleteRegistry(): DeferredDeleteRegistry {
    const slots = new Map<DeferredDeleteKind, Slot>();
    // Held rather than captured per request: a delete must land in the database
    // the app is on when its window closes, not the one it was on when the swipe
    // happened.
    let database: Database | null = null;

    function build(kind: DeferredDeleteKind): Slot {
        const spec = SPECS[kind];
        const listeners = new Set<() => void>();
        let body: string | undefined;
        let toastId: string | null = null;
        let toastFor: string | null = null;

        const controller = createDeferredDelete({
            commit: async (id) => {
                const db = database;
                if (db === null) {
                    throw new Error("The local database went away before the delete could be written");
                }
                await spec.commit(db, id);
            },
            onChange: (next) => {
                // Keyed on the id rather than on null-ness: a second delete inside an
                // open window replaces the first, and reusing that toast would leave
                // the new row's undo expiring on the old row's clock.
                if (next.pendingId !== toastFor) {
                    if (toastId !== null) {
                        dismissNotice(toastId);
                    }
                    toastFor = next.pendingId;
                    toastId =
                        next.pendingId === null
                            ? null
                            : notifyUndoable({
                                  actionLabel: translateNow("common.undo"),
                                  body,
                                  duration: UNDO_WINDOW_MS,
                                  onActionPress: () => controller.undo(),
                                  title: translateNow(spec.undoTitle),
                              });
                }
                if (next.failedId !== null) {
                    notifyFailure({
                        body: translateNow(spec.failedBody),
                        title: translateNow(spec.failedTitle),
                    });
                    // Dropped as it is shown: the controller holds a failure until it is
                    // acknowledged, so leaving it set raises the same toast again on the
                    // next publish.
                    controller.acknowledgeFailure();
                }
                for (const listener of listeners) {
                    listener();
                }
            },
            timers: {
                clear: (handle: ReturnType<typeof setTimeout>) => {
                    clearTimeout(handle);
                },
                set: (run: () => void, ms: number) => setTimeout(run, ms),
            },
            windowMs: UNDO_WINDOW_MS,
        });

        return {
            controller,
            listeners,
            setBody: (next) => {
                body = next;
            },
        };
    }

    function slotFor(kind: DeferredDeleteKind): Slot {
        const existing = slots.get(kind);
        if (existing) {
            return existing;
        }
        const created = build(kind);
        slots.set(kind, created);
        return created;
    }

    return {
        attachDatabase: (db) => {
            database = db;
        },
        flushAll: async () => {
            await Promise.all(Array.from(slots.values(), (slot) => slot.controller.flush()));
        },
        pendingId: (kind) => slots.get(kind)?.controller.snapshot.pendingId ?? null,
        requestDelete: (kind, id, body) => {
            const slot = slotFor(kind);
            slot.setBody(body);
            slot.controller.requestDelete(id);
        },
        subscribe: (kind, listener) => {
            const slot = slotFor(kind);
            slot.listeners.add(listener);
            return () => {
                slot.listeners.delete(listener);
            };
        },
    };
}
