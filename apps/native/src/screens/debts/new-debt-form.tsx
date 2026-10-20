import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Keyboard } from "react-native";

import { AccountPickerSheet } from "@/components/account-picker-sheet";
import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { CategoryPickerSheet } from "@/components/category-picker-sheet";
import { CurrencyPickerSheet } from "@/components/currency-picker-sheet";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccountBalance, useBankAccounts, usePeople } from "@/data/accounts";
import { accountsRepo, getLastUsedAccount } from "@/data/accounts-core";
import type { Account } from "@/data/accounts-core";
import { useGlobalCurrency } from "@/data/app-meta";
import type { Category } from "@/data/categories-core";
import { createPerson, recordDebtMovement, recordSoldOnCredit } from "@/data/debts-core";
import { setPayoffPlan } from "@/data/payoff-plans";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import { comesFromPerson, debtChoices, debtStanding } from "@/domain/debt-choices";
import type { DebtVerb } from "@/domain/debts";
import { addLocalMonths } from "@/domain/local-day";
import { minorUnitsFor, roundToMinorUnits } from "@/domain/money";
import { numpadToNumber } from "@/domain/numpad";
import { useAccountCreateRoute, usePayoffPlanGate, usePeopleCapped } from "@/hooks/use-pro-gate";
import { useTranslation } from "@/i18n/context";
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";

const MAX_SUGGESTIONS = 4;

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * The person a debt is with: the one the sheet was opened for, else whoever the
 * typed name matches. Until one is settled, the people whose names hold the
 * typed text are offered under the field.
 */
function resolvePerson(people: readonly Account[], personId: string | undefined, name: string) {
    const lockedPerson = personId === undefined ? null : (people.find((row) => row.id === personId) ?? null);
    const person = lockedPerson ?? people.find((row) => sameName(row.name, name)) ?? null;
    const query = name.trim().toLocaleLowerCase();
    const suggestions =
        person === null
            ? people.filter((row) => row.name.toLocaleLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS)
            : [];
    return { lockedPerson, person, suggestions };
}

interface DebtDraft {
    /** Null only for a new person whose debt predates Outlayr. */
    account: Account | null;
    amount: number;
    /** Set for a sale on credit, which records income instead of a movement. */
    category: Category | null;
    /** The amount's currency, which a new person takes. */
    currency: string;
    date: Date;
    newName: string;
    note: string;
    person: Account | null;
    /** The person's side of a cross-currency movement, in their currency. */
    theirAmount: number;
    verb: DebtVerb;
}

/**
 * Creates the person when the name is new, then records the sale on credit or
 * the movement. With no account the debt is from before Outlayr: no money
 * moved, so it becomes the new person's opening balance, negative when you borrowed.
 * Returns the person's id.
 */
async function writeDebt(db: Database, draft: DebtDraft): Promise<string> {
    const { account, amount, category, currency, person } = draft;
    const note = draft.note === "" ? undefined : draft.note;
    if (category !== null) {
        const buyer = person ?? { currency, id: await createPerson(db, { currency, name: draft.newName }) };
        await recordSoldOnCredit(db, { amount, categoryId: category.id, date: draft.date, note, person: buyer });
        return buyer.id;
    }
    if (account === null) {
        return await createPerson(db, {
            currency,
            name: draft.newName,
            openingBalance: comesFromPerson(draft.verb) ? -amount : amount,
        });
    }
    const target = person ?? { currency, id: await createPerson(db, { currency, name: draft.newName }) };
    const crossCurrency = target.currency !== account.currency;
    await recordDebtMovement(db, {
        account: { accountId: account.id, amount, currency: account.currency },
        date: draft.date,
        note,
        person: { accountId: target.id, amount: crossCurrency ? draft.theirAmount : amount, currency: target.currency },
        rateType: crossCurrency ? "custom" : null,
        verb: draft.verb,
    });
    return target.id;
}

/** Sets the person's plan once the debt is written; a balance that is not a debt sets none. */
async function writePayoffPlan(db: Database, personId: string, targetDate: Date): Promise<void> {
    const people = await accountsRepo.listActive(db);
    const person = people.find((row) => row.id === personId);
    if (person) {
        await setPayoffPlan(db, person, targetDate);
    }
}

interface DraftInput {
    account: Account | null;
    amountText: string;
    category: Category | null;
    name: string;
    newCurrency: string;
    person: Account | null;
    soldOnCredit: boolean;
    theirText: string;
}

/** What the sheet's fields add up to, and whether that is enough to save. */
function readDraft(input: DraftInput) {
    const { account, category, person, soldOnCredit } = input;
    // Before Outlayr: no account moved, so the amount becomes a new person's opening balance.
    const before = !soldOnCredit && account === null && person === null;
    const currency = (soldOnCredit ? null : account?.currency) ?? person?.currency ?? input.newCurrency;
    const amount = roundToMinorUnits(numpadToNumber(input.amountText), currency);
    const crossCurrency = !soldOnCredit && person !== null && account !== null && person.currency !== account.currency;
    const theirAmount = person === null ? 0 : roundToMinorUnits(numpadToNumber(input.theirText), person.currency);
    const newName = person === null ? input.name.trim() : "";
    const complete =
        amount > 0 &&
        (person !== null || newName !== "") &&
        (soldOnCredit ? category !== null : account !== null || before) &&
        (!crossCurrency || theirAmount > 0);
    /** The person's currency when their side is typed separately, else null. */
    const theirCurrency = crossCurrency ? person.currency : null;
    /** A new person with no account to take a currency from picks one, which they keep. */
    const pickCurrency = person === null && (soldOnCredit || account === null);
    return { amount, before, complete, currency, newName, pickCurrency, theirAmount, theirCurrency };
}

export function present(sheet: RefObject<BottomSheetModal | null>) {
    Keyboard.dismiss();
    sheet.current?.present();
}

export interface NewDebtProps {
    onDirtyChange: (dirty: boolean) => void;
    onDone: () => void;
    /** Fills in the person, from their detail screen. */
    personId?: string;
    verb?: DebtVerb;
}

/**
 * The New debt form behind both platforms' screens: borrowing from, lending
 * to, paying back or being paid back by a person, plus Fiado, a sale on credit
 * that asks for an income category instead of an account. A typed name that
 * matches nobody creates the person on save, and for a new person "Into" may be
 * None, which makes the amount their opening balance instead of a transfer.
 */
export function useNewDebtForm({ onDirtyChange, onDone, personId, verb: initialVerb }: NewDebtProps) {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const haptics = useHaptics();
    const people = usePeople(db);
    const banks = useBankAccounts(db);
    const globalCurrency = useGlobalCurrency(db);
    const peopleCapped = usePeopleCapped();
    const payoffGate = usePayoffPlanGate();
    const nowMs = useNow();

    const [name, setName] = useState("");
    const { lockedPerson, person, suggestions } = resolvePerson(people, personId, name);

    const [verb, setVerb] = useState<DebtVerb>(initialVerb ?? "borrowed");
    const [soldOnCredit, setSoldOnCredit] = useState(false);
    const [category, setCategory] = useState<Category | null>(null);
    const [accountId, setAccountId] = useState<string | null>(() => getLastUsedAccount(db)?.id ?? banks[0]?.id ?? null);
    const account = banks.find((row) => row.id === accountId) ?? null;
    const [newCurrency, setNewCurrency] = useState(globalCurrency);
    const [amountText, setAmountText] = useState("");
    const [theirText, setTheirText] = useState("");
    const [date, setDate] = useState(() => new Date());
    const [note, setNote] = useState("");
    /** "Pay back by": null sets no plan. */
    const [payBackBy, setPayBackBy] = useState<Date | null>(null);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    const amountSheet = useRef<BottomSheetModal>(null);
    const theirSheet = useRef<BottomSheetModal>(null);
    const accountSheet = useRef<BottomSheetModal>(null);
    const currencySheet = useRef<BottomSheetModal>(null);
    const categorySheet = useRef<BottomSheetModal>(null);

    const balance = useAccountBalance(
        db,
        person ?? { currency: globalCurrency, id: "", initialBalance: 0 },
        nowMs
    ).total;
    const choices = debtChoices(person === null ? null : debtStanding(balance, person.currency));
    const incoming = !soldOnCredit && comesFromPerson(verb);
    const choice = choices.find((option) => comesFromPerson(option.verb) === incoming) ?? choices[0];

    const draft = readDraft({ account, amountText, category, name, newCurrency, person, soldOnCredit, theirText });

    useEffect(() => {
        onDirtyChange(amountText !== "" || name.trim() !== "" || note.trim() !== "" || payBackBy !== null);
    }, [amountText, name, note, payBackBy, onDirtyChange]);

    const save = async () => {
        if (person === null && peopleCapped) {
            router.push("/paywall");
            return;
        }
        setBusy(true);
        setFailure(null);
        let debtorId: string;
        try {
            debtorId = await writeDebt(db, {
                account,
                amount: draft.amount,
                category: soldOnCredit ? category : null,
                currency: draft.currency,
                date,
                newName: draft.newName,
                note: note.trim(),
                person,
                theirAmount: draft.theirAmount,
                verb: choice.verb,
            });
        } catch (error) {
            console.error("Failed to save the debt", error);
            haptics("error");
            setFailure(t("debts.error.saveFailed"));
            setBusy(false);
            return;
        }
        // The debt stands on its own: a plan that fails is said, and the sheet still closes.
        if (payBackBy !== null) {
            try {
                await writePayoffPlan(db, debtorId, payBackBy);
            } catch (error) {
                console.error("Failed to save the payoff plan", error);
                notifyFailure({ title: t("debts.plan.failed") });
            }
        }
        haptics("success");
        onDone();
    };
    const handlers = useRef({ save });
    useLayoutEffect(() => {
        handlers.current = { save };
    });
    // Reads only the ref, so the compiler keeps it stable and the Save button does not re-register per keystroke.
    const onSave = () => {
        void handlers.current.save();
    };

    return {
        ...draft,
        account,
        accountId,
        accountSheet,
        accountLabel: t(incoming ? "debts.field.accountInto" : "debts.field.accountFrom"),
        accountValue: account?.name ?? (draft.before ? t("debts.field.before") : ""),
        amountSheet,
        amountText,
        canSave: !busy && draft.complete,
        category,
        categorySheet,
        choice,
        choices,
        currencySheet,
        date,
        failure,
        lockedPerson,
        name,
        note,
        nowMs,
        onSave,
        /** Turns "Pay back by" on a month out, unless the free plan's payoff plans are all taken. */
        openPayBackBy: () => payoffGate(person?.id ?? null, () => setPayBackBy(addLocalMonths(nowMs, 1))),
        payBackBy,
        person,
        personLabel: t(incoming ? "debts.field.personFrom" : "debts.field.personTo"),
        setAccountId,
        setAmountText,
        setCategory,
        setDate,
        setName,
        setNewCurrency,
        setNote,
        setPayBackBy,
        setSoldOnCredit,
        setTheirText,
        setVerb,
        soldOnCredit,
        suggestions,
        theirSheet,
        theirText,
    };
}

/** The sheets the form's fields open, the same on both platforms. */
export function NewDebtSheets({ form }: { form: ReturnType<typeof useNewDebtForm> }) {
    const db = useDatabase();
    const router = useRouter();
    const accountCreateRoute = useAccountCreateRoute();
    const { accountSheet, amountSheet, categorySheet, currencySheet, person, theirSheet } = form;

    return (
        <>
            <AmountEntrySheet
                code={form.currency}
                minorUnits={minorUnitsFor(form.currency)}
                onChange={form.setAmountText}
                onDone={() => amountSheet.current?.dismiss()}
                ref={amountSheet}
                value={form.amountText}
            />
            {person === null ? null : (
                <AmountEntrySheet
                    code={person.currency}
                    minorUnits={minorUnitsFor(person.currency)}
                    onChange={form.setTheirText}
                    onDone={() => theirSheet.current?.dismiss()}
                    ref={theirSheet}
                    value={form.theirText}
                />
            )}
            <AccountPickerSheet
                allowNone={person === null}
                db={db}
                onCreate={() => {
                    accountSheet.current?.dismiss();
                    router.push(accountCreateRoute);
                }}
                onSelect={(picked: Account | null) => form.setAccountId(picked?.id ?? null)}
                ref={accountSheet}
                selectedId={form.accountId}
            />
            <CategoryPickerSheet
                db={db}
                income
                onSelect={(picked) => {
                    categorySheet.current?.dismiss();
                    form.setCategory(picked);
                }}
                ref={categorySheet}
                selectedId={form.category?.id ?? null}
            />
            <CurrencyPickerSheet
                onSelect={(code) => {
                    currencySheet.current?.dismiss();
                    form.setNewCurrency(code);
                }}
                ref={currencySheet}
                selected={form.currency}
            />
        </>
    );
}
