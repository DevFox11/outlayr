import { and, desc, eq, isNull, or } from "drizzle-orm";
import { useMemo } from "react";

import type { SpendDb } from "@/data/budget-spent";
import type { Database } from "@/db/client";
import { transfers } from "@/db/schema";
import { toTransferLogRow } from "@/domain/transfer-log-rows";
import type { TransferLogRow } from "@/domain/transfer-log-rows";

import { useAccounts } from "./accounts";
import { useLiveQuery } from "./live-query";
import { useTransferFees } from "./transfer-log";

function accountTransfersQuery(db: SpendDb, accountId: string) {
    return db
        .select()
        .from(transfers)
        .where(
            and(
                isNull(transfers.deletedAt),
                or(eq(transfers.fromAccountId, accountId), eq(transfers.toAccountId, accountId))
            )
        )
        .orderBy(desc(transfers.day), desc(transfers.date));
}

export function useAccountTransfers(db: Database, accountId: string): TransferLogRow[] {
    const accounts = useAccounts(db);
    const rows = useLiveQuery(transfers, () => accountTransfersQuery(db, accountId), [accountId]);
    const fees = useTransferFees(db);
    const names = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
    return useMemo(() => rows.map((row) => toTransferLogRow(row, names, fees)), [rows, names, fees]);
}
