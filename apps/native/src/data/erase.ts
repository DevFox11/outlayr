import type { Database } from "@/db/client";
import {
	budgets,
	mainBudget,
	templateTransactions,
	transactions,
} from "@/db/schema";
import { clearSpotlight } from "@/lib/spotlight";

export type EraseScope = "transactions" | "everything";

/**
 * Categories survive both scopes — erasing those lives on the Categories screen.
 * Deletes run dependants-first so a partial failure leaves nothing pointing at a
 * deleted transaction.
 *
 * The Spotlight index lives in the system's store rather than the database, so
 * nothing above would touch it. Both scopes clear it; it is rebuilt from
 * whatever survives on the next open or background.
 */
export async function eraseData(
	db: Database,
	scope: EraseScope,
): Promise<void> {
	await db.delete(transactions);
	await db.delete(templateTransactions);

	if (scope === "everything") {
		await db.delete(budgets);
		await db.delete(mainBudget);
	}

	await clearSpotlight();
}
