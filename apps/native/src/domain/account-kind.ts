/**
 * Whether an account holds money or owes it.
 *
 * Two values rather than a list of account types. The distinction the ledger
 * cannot currently make is "own" versus "owe" — a credit card is an account
 * with a negative balance and nothing says it is different in kind from a
 * checking account that is overdrawn. Naming the types (checking, savings,
 * card, loan) would be presentation on top of this, and buys nothing until
 * there is a payoff or forecast feature to hang off it.
 */
export const ACCOUNT_KINDS = ["asset", "liability"] as const;

export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const DEFAULT_ACCOUNT_KIND: AccountKind = "asset";

/**
 * Every account written before this column existed. Asset is correct for all of
 * them: the ledger had no way to express a liability, so nobody recorded one.
 */
export function toAccountKind(value: string | null | undefined): AccountKind {
    return value === "liability" ? "liability" : DEFAULT_ACCOUNT_KIND;
}

export interface Balanced {
    /** Signed, as stored. A card that has been charged is negative. */
    balance: number;
    kind: AccountKind;
}

export interface NetWorth {
    /** Everything, which is the same figure the accounts card totals today. */
    net: number;
    /** Positive when money is owed, so it reads as a debt rather than a negative. */
    owe: number;
    own: number;
}

/**
 * Splits the accounts total into what is held and what is owed.
 *
 * Balances stay signed and `kind` stays purely semantic, so `net` is the plain
 * sum it has always been — this adds a reading, it does not restate any figure.
 * A liability's balance is negative, so `owe` negates it to state a debt as a
 * positive number; an overpaid card therefore reports a negative `owe`, which
 * is true and rare.
 */
export function netWorth(accounts: readonly Balanced[]): NetWorth {
    let own = 0;
    let owed = 0;
    for (const account of accounts) {
        if (account.kind === "liability") {
            owed += account.balance;
        } else {
            own += account.balance;
        }
    }
    // Not just `-owed`: negating a zero gives -0, which formats as "-$0.00" on a
    // ledger that simply has no debts.
    return { net: own + owed, owe: owed === 0 ? 0 : -owed, own };
}
