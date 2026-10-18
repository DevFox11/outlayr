/**
 * Whether an account holds money, owes it, or is a person money moves with.
 *
 * Three values rather than a list of account types. The distinction the ledger
 * could not make before is "own" versus "owe" — a credit card is an account
 * with a negative balance and nothing says it is different in kind from a
 * checking account that is overdrawn. Naming the types (checking, savings,
 * card, loan) would be presentation on top of this.
 *
 * A person is the one kind whose sign is the direction: a positive balance is
 * money they owe you, a negative one is money you owe them, and lending and
 * borrowing are transfers that flip it with no extra state.
 */
const ACCOUNT_KINDS = ["asset", "liability", "person"] as const;

export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const DEFAULT_ACCOUNT_KIND: AccountKind = "asset";

/**
 * Every account written before this column existed. Asset is correct for all of
 * them: the ledger had no way to express a liability, so nobody recorded one.
 */
export function toAccountKind(value: string | null | undefined): AccountKind {
    return ACCOUNT_KINDS.find((kind) => kind === value) ?? DEFAULT_ACCOUNT_KIND;
}

/** People live on Debts, never on the lists of accounts that hold money. */
export function isPerson(account: { kind?: string | null }): boolean {
    return toAccountKind(account.kind) === "person";
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
 * is true and rare. A person goes by sign instead: what they owe you is held,
 * what you owe them is owed.
 */
export function netWorth(accounts: readonly Balanced[]): NetWorth {
    let own = 0;
    let owed = 0;
    for (const account of accounts) {
        const owes = account.kind === "liability" || (account.kind === "person" && account.balance < 0);
        if (owes) {
            owed += account.balance;
        } else {
            own += account.balance;
        }
    }
    // Not just `-owed`: negating a zero gives -0, which formats as "-$0.00" on a
    // ledger that simply has no debts.
    return { net: own + owed, owe: owed === 0 ? 0 : -owed, own };
}
