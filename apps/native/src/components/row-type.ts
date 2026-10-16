/**
 * The type of the ledger's list rows and figure cells. Colour stays with each
 * caller. It reaches every screen that renders `TransactionRow`, `RowAmount`,
 * `DayTotal`, `MeasureCellAmount` or `LedgerHead`: the Log, Insights, search,
 * budget detail, account detail, Settings › Upcoming, Recently deleted and the
 * import review.
 *
 * iOS sets these in the rounded face at its own sizes; `row-type.android.ts`
 * is Material 3's two-line list item (bodyLarge over bodyMedium) at Direction
 * B's weights.
 */
export const ROW_TYPE = {
    /** A row's trailing amount (`RowAmount`). */
    amount: "font-sans-medium text-title",
    /** An account row's trailing balance. */
    balance: "font-sans-medium text-callout",
    /** A promotable figure under a mono label (`LedgerHead`, `MeasureCellAmount`). */
    cell: "font-sans-semibold text-body",
    /** A category breakdown row's name. */
    name: "font-sans-semibold text-body",
    /** A row's second line: the time, the category, "Owed". */
    subtitle: "font-sans-medium text-subtitle",
    /** The weight of a day or section subtotal; the size is the caller's. */
    subtotal: "font-sans-semibold",
    /** A row's first line: the note or the account name. */
    title: "font-sans-medium text-callout",
} as const;
