import { Host } from "@expo/ui";
import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import {
    DatePicker,
    Divider,
    HStack,
    Image,
    Picker,
    RNHostView,
    ScrollView,
    Spacer,
    Text as SwiftText,
    TextField,
    useNativeState,
    VStack,
} from "@expo/ui/swift-ui";
import {
    accessibilityAddTraits,
    accessibilityElement,
    accessibilityLabel,
    accessibilityValue,
    datePickerStyle,
    font,
    foregroundStyle,
    labelsHidden,
    lineLimit,
    multilineTextAlignment,
    onTapGesture,
    overlay,
    padding,
    pickerStyle,
    scrollDismissesKeyboard,
    submitLabel,
    tag,
    textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { Stack, useRouter } from "expo-router";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { use, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Keyboard, Pressable, View } from "react-native";

import { AccountPickerSheet } from "@/components/account-picker-sheet";
import { AccountTile } from "@/components/account-tile";
import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { HeroNumber } from "@/components/amount-text";
import { CategoryPickerSheet } from "@/components/category-picker-sheet";
import { CurrencyPickerSheet } from "@/components/currency-picker-sheet";
import { InlineFailure } from "@/components/form/inline-failure";
import { toolbarIcon } from "@/components/toolbar-icons";
import { BODY, ROW, rowLabel } from "@/components/transaction-form/style";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccountBalance, useBankAccounts, usePeople } from "@/data/accounts";
import { getLastUsedAccount } from "@/data/accounts-core";
import type { Account } from "@/data/accounts-core";
import { useGlobalCurrency } from "@/data/app-meta";
import type { Category } from "@/data/categories-core";
import { createPerson, recordDebtMovement, recordSoldOnCredit } from "@/data/debts-core";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import { comesFromPerson, debtChoices, debtStanding } from "@/domain/debt-choices";
import type { DebtVerb } from "@/domain/debts";
import { formatAmount, minorUnitsFor, roundToMinorUnits } from "@/domain/money";
import { numpadToNumber } from "@/domain/numpad";
import { usePeopleCapped } from "@/hooks/use-pro-gate";
import { useLanguage, useTranslation } from "@/i18n/context";
import { hitArea, outline } from "@/lib/swift-ui-geometry";
import { useHaptics } from "@/lib/use-haptics";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

const CHEVRON = font({ design: "rounded", textStyle: "footnote", weight: "semibold" });
const MAX_SUGGESTIONS = 4;
const SUGGESTION_TILE = 22;
const SEGMENT_HEIGHT = 32;
/** The segment past the debt choices: a sale on credit, which is income rather than a transfer. */
const FIADO = "fiado";

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
 */
async function writeDebt(db: Database, draft: DebtDraft): Promise<void> {
    const { account, amount, category, currency, person } = draft;
    const note = draft.note === "" ? undefined : draft.note;
    if (category !== null) {
        const buyer = person ?? { currency, id: await createPerson(db, { currency, name: draft.newName }) };
        await recordSoldOnCredit(db, { amount, categoryId: category.id, date: draft.date, note, person: buyer });
        return;
    }
    if (account === null) {
        await createPerson(db, {
            currency,
            name: draft.newName,
            openingBalance: comesFromPerson(draft.verb) ? -amount : amount,
        });
        return;
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

function present(sheet: RefObject<BottomSheetModal | null>) {
    Keyboard.dismiss();
    sheet.current?.present();
}

interface NewDebtProps {
    onDirtyChange: (dirty: boolean) => void;
    onDone: () => void;
    /** Fills in the person, from their detail screen. */
    personId?: string;
    verb?: DebtVerb;
}

/**
 * Borrowing from, lending to, paying back or being paid back by a person: one
 * sheet for every direction, plus Fiado, a sale on credit that asks for an
 * income category instead of an account. A typed name that matches nobody
 * creates the person on save, and for a new person "Into" may be None, which
 * makes the amount their opening balance instead of a transfer.
 */
export function NewDebt({ onDirtyChange, onDone, personId, verb: initialVerb }: NewDebtProps) {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const { language } = useLanguage();
    const colors = useColors();
    const haptics = useHaptics();
    const { showCents } = useDisplaySettings().state;
    const people = usePeople(db);
    const banks = useBankAccounts(db);
    const globalCurrency = useGlobalCurrency(db);
    const peopleCapped = usePeopleCapped();
    const nowMs = useNow();
    const headerHeight = use(HeaderHeightContext) ?? 0;

    const nameState = useNativeState("");
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
    const noteState = useNativeState("");
    const [note, setNote] = useState("");
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

    const { amount, before, complete, currency, newName, pickCurrency, theirAmount, theirCurrency } = readDraft({
        account,
        amountText,
        category,
        name,
        newCurrency,
        person,
        soldOnCredit,
        theirText,
    });
    const canSave = !busy && complete;

    useEffect(() => {
        onDirtyChange(amountText !== "" || name.trim() !== "" || note.trim() !== "");
    }, [amountText, name, note, onDirtyChange]);

    const save = async () => {
        if (person === null && peopleCapped) {
            router.push("/paywall");
            return;
        }
        setBusy(true);
        setFailure(null);
        try {
            await writeDebt(db, {
                account,
                amount,
                category: soldOnCredit ? category : null,
                currency,
                date,
                newName,
                note: note.trim(),
                person,
                theirAmount,
                verb: choice.verb,
            });
            haptics("success");
            onDone();
        } catch (error) {
            console.error("Failed to save the debt", error);
            haptics("error");
            setFailure(t("debts.error.saveFailed"));
            setBusy(false);
        }
    };

    const hairline = [overlay({ color: withAlpha(colors.foreground, 0.08) })];
    const openAmount = () => present(amountSheet);
    const openTheirs = () => present(theirSheet);
    const openAccounts = () => present(accountSheet);
    const openCurrencies = () => present(currencySheet);
    const openCategories = () => present(categorySheet);

    const personLabel = t(incoming ? "debts.field.personFrom" : "debts.field.personTo");
    const accountLabel = t(incoming ? "debts.field.accountInto" : "debts.field.accountFrom");
    const accountValue = account?.name ?? (before ? t("debts.field.before") : "");

    return (
        <View style={{ backgroundColor: colors.groupedBackground, flex: 1 }}>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("done")}
                    accessibilityLabel={t("common.save")}
                    disabled={!canSave}
                    onPress={() => {
                        void save();
                    }}
                />
            </Stack.Toolbar>

            <View className="items-center gap-4 px-5 pb-2" style={{ paddingTop: headerHeight + 8 }}>
                <Host style={{ alignSelf: "stretch", height: SEGMENT_HEIGHT }}>
                    <Picker
                        label=""
                        modifiers={[pickerStyle("segmented")]}
                        onSelectionChange={(value) => {
                            const picked = choices.find((option) => option.verb === value);
                            setSoldOnCredit(value === FIADO);
                            if (picked) {
                                setVerb(picked.verb);
                            }
                        }}
                        selection={soldOnCredit ? FIADO : choice.verb}
                    >
                        {choices.map((option) => (
                            <SwiftText key={option.verb} modifiers={[tag(option.verb)]}>
                                {t(option.labelKey)}
                            </SwiftText>
                        ))}
                        <SwiftText modifiers={[tag(FIADO)]}>{t("debts.verb.soldOnCredit")}</SwiftText>
                    </Picker>
                </Host>
                <Pressable
                    accessibilityLabel={t("debts.a11y.amount")}
                    accessibilityRole="button"
                    className="active:opacity-70"
                    onPress={openAmount}
                >
                    <HeroNumber amount={amount} code={currency} showCents={showCents} sign="" />
                </Pressable>
            </View>

            <Host style={{ flex: 1 }}>
                <ScrollView modifiers={[scrollDismissesKeyboard("immediately")]}>
                    <VStack modifiers={[padding({ horizontal: 20, top: 8 })]} spacing={0}>
                        <Divider modifiers={hairline} />
                        <PersonField
                            label={personLabel}
                            lockedName={lockedPerson?.name ?? null}
                            nameState={nameState}
                            onName={setName}
                        />
                        {suggestions.map((row) => (
                            <PersonSuggestion
                                key={row.id}
                                onPick={() => {
                                    nameState.set(row.name);
                                    setName(row.name);
                                }}
                                person={row}
                            />
                        ))}
                        <Divider modifiers={hairline} />
                        {soldOnCredit ? (
                            <PickerField
                                chevron
                                label={t("transaction.field.category")}
                                onPress={openCategories}
                                value={category?.name ?? ""}
                            />
                        ) : (
                            <PickerField chevron label={accountLabel} onPress={openAccounts} value={accountValue} />
                        )}
                        {theirCurrency === null ? null : (
                            <>
                                <Divider modifiers={hairline} />
                                <PickerField
                                    label={t("debts.field.theirSide", { currency: theirCurrency })}
                                    onPress={openTheirs}
                                    value={formatAmount(theirAmount, theirCurrency, true, language)}
                                />
                            </>
                        )}
                        {pickCurrency ? (
                            <>
                                <Divider modifiers={hairline} />
                                <PickerField
                                    chevron
                                    label={t("debts.field.currency")}
                                    onPress={openCurrencies}
                                    value={currency}
                                />
                            </>
                        ) : null}
                        {before ? null : (
                            <>
                                <Divider modifiers={hairline} />
                                <HStack modifiers={ROW}>
                                    <SwiftText modifiers={[BODY, rowLabel]}>{t("debts.field.date")}</SwiftText>
                                    <Spacer />
                                    <DatePicker
                                        displayedComponents={["date"]}
                                        modifiers={[datePickerStyle("compact"), labelsHidden()]}
                                        onDateChange={setDate}
                                        range={{ end: new Date(nowMs) }}
                                        selection={date}
                                    />
                                </HStack>
                                <Divider modifiers={hairline} />
                                <HStack modifiers={ROW}>
                                    <SwiftText modifiers={[BODY, rowLabel]}>{t("debts.field.note")}</SwiftText>
                                    <Spacer />
                                    <TextField
                                        modifiers={[
                                            BODY,
                                            foregroundStyle(colors.foreground),
                                            multilineTextAlignment("trailing"),
                                            submitLabel("done"),
                                        ]}
                                        onTextChange={setNote}
                                        placeholder={t("debts.field.notePlaceholder")}
                                        text={noteState}
                                    />
                                </HStack>
                            </>
                        )}
                        <Divider modifiers={hairline} />
                    </VStack>
                </ScrollView>
            </Host>

            <View className="px-5 pb-8">
                <InlineFailure message={failure} />
            </View>

            <AmountEntrySheet
                code={currency}
                minorUnits={minorUnitsFor(currency)}
                onChange={setAmountText}
                onDone={() => amountSheet.current?.dismiss()}
                ref={amountSheet}
                value={amountText}
            />
            {person === null ? null : (
                <AmountEntrySheet
                    code={person.currency}
                    minorUnits={minorUnitsFor(person.currency)}
                    onChange={setTheirText}
                    onDone={() => theirSheet.current?.dismiss()}
                    ref={theirSheet}
                    value={theirText}
                />
            )}
            <AccountPickerSheet
                allowNone={person === null}
                db={db}
                onCreate={() => router.push("/accounts/create")}
                onSelect={(picked: Account | null) => setAccountId(picked?.id ?? null)}
                ref={accountSheet}
                selectedId={accountId}
            />
            <CategoryPickerSheet
                db={db}
                income
                onSelect={(picked) => {
                    categorySheet.current?.dismiss();
                    setCategory(picked);
                }}
                ref={categorySheet}
                selectedId={category?.id ?? null}
            />
            <CurrencyPickerSheet
                onSelect={(code) => {
                    currencySheet.current?.dismiss();
                    setNewCurrency(code);
                }}
                ref={currencySheet}
                selected={currency}
            />
        </View>
    );
}

/** An existing person under the name field, so a debt with them is one tap rather than a retyped name. */
function PersonSuggestion({ onPick, person }: { onPick: () => void; person: Account }) {
    const colors = useColors();
    return (
        <HStack
            modifiers={[
                ...ROW,
                hitArea(outline.rectangle()),
                onTapGesture(onPick),
                accessibilityElement("combine"),
                accessibilityAddTraits(["isButton"]),
                accessibilityLabel(person.name),
            ]}
            spacing={10}
        >
            <Spacer />
            <SwiftText modifiers={[BODY, lineLimit(1), foregroundStyle(colors.tint)]}>{person.name}</SwiftText>
            <RNHostView matchContents>
                <View style={{ height: SUGGESTION_TILE, width: SUGGESTION_TILE }}>
                    <AccountTile account={person} radius={6} size={SUGGESTION_TILE} />
                </View>
            </RNHostView>
        </HStack>
    );
}

interface PickerFieldProps {
    /** The up-down chevron of a row that opens a list rather than a keypad. */
    chevron?: boolean;
    label: string;
    onPress: () => void;
    value: string;
}

/** A row that opens a sheet, read by VoiceOver as one button. */
function PickerField({ chevron = false, label, onPress, value }: PickerFieldProps) {
    const colors = useColors();
    return (
        <HStack
            modifiers={[
                ...ROW,
                hitArea(outline.rectangle()),
                onTapGesture(onPress),
                accessibilityElement("combine"),
                accessibilityAddTraits(["isButton"]),
                accessibilityLabel(label),
                accessibilityValue(value),
            ]}
        >
            <SwiftText modifiers={[BODY, rowLabel]}>{label}</SwiftText>
            <Spacer />
            <SwiftText modifiers={[BODY, lineLimit(1), foregroundStyle(colors.foreground)]}>{value}</SwiftText>
            {chevron ? <Image color={colors.muted} modifiers={[CHEVRON]} systemName="chevron.up.chevron.down" /> : null}
        </HStack>
    );
}

interface PersonFieldProps {
    label: string;
    /** The person the sheet was opened for, who is not to be retyped. */
    lockedName: string | null;
    nameState: ReturnType<typeof useNativeState<string>>;
    onName: (name: string) => void;
}

function PersonField({ label, lockedName, nameState, onName }: PersonFieldProps) {
    const t = useTranslation();
    const colors = useColors();
    return (
        <HStack modifiers={ROW}>
            <SwiftText modifiers={[BODY, rowLabel]}>{label}</SwiftText>
            <Spacer />
            {lockedName === null ? (
                <TextField
                    modifiers={[
                        BODY,
                        foregroundStyle(colors.foreground),
                        multilineTextAlignment("trailing"),
                        textInputAutocapitalization("words"),
                        submitLabel("done"),
                    ]}
                    onTextChange={onName}
                    placeholder={t("debts.field.personPlaceholder")}
                    text={nameState}
                />
            ) : (
                <SwiftText modifiers={[BODY, foregroundStyle(colors.foreground)]}>{lockedName}</SwiftText>
            )}
        </HStack>
    );
}
