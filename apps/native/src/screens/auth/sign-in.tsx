import { currencyDisplayFor } from "@outlayr/money/currency";
import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { View } from "react-native";

import { ProviderSignInButtons } from "@/components/account/provider-sign-in-buttons";
import { FirstRun } from "@/components/first-run";
import { Text } from "@/components/text";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { useReminderChosen } from "@/data/onboarding";
import { deferAccount } from "@/data/onboarding-core";
import { flyleafDate } from "@/domain/flyleaf";
import { clampTimeOfDay, formatTimeOfDay, reminderTime } from "@/domain/reminder";
import { useLanguage, useTranslation } from "@/i18n/context";
import { authClient } from "@/lib/auth-client";
import { legalUrl } from "@/lib/legal-url";
import { useProviderSignIn } from "@/lib/use-provider-sign-in";

type AuthClient = NonNullable<typeof authClient>;

const PLACEHOLDER = /\{\w+\}/;

export function SignIn() {
    if (authClient === null) {
        return null;
    }
    return <SignInContent client={authClient} />;
}

/**
 * Renders an i18n template around its one value so the value can carry the
 * mono voice: words are said, figures are entered. The template arrives with
 * its placeholder intact — `t` leaves `{braces}` alone when no params are
 * passed — and is split here instead of interpolated.
 */
function FlyleafLine({ template, value, quiet }: { template: string; value: string; quiet?: boolean }) {
    const [before, after] = template.split(PLACEHOLDER);
    // "Bs." + the template's own full stop would print "Bs.." — the value's
    // trailing period absorbs the sentence's.
    const tail = value.endsWith(".") && after?.startsWith(".") ? after.slice(1) : after;
    return (
        <Text className={quiet ? "text-fr-muted text-label" : "font-sans-medium text-callout text-fr-ink leading-8"}>
            {before}
            <Text
                className={
                    quiet
                        ? "text-fr-ink text-micro font-mono tabular-nums"
                        : "font-mono-medium text-body text-fr-ink tabular-nums"
                }
            >
                {value}
            </Text>
            {tail}
        </Text>
    );
}

/**
 * The stage object: the ledger's flyleaf, written during the flow — what an
 * account would actually be keeping a copy of. The reminder line only appears
 * when the rhythm step's offer was taken; a skipped question leaves shorter
 * prose, not a hole.
 */
function FlyleafCard() {
    const db = useDatabase();
    const t = useTranslation();
    const { language } = useLanguage();
    const currency = useGlobalCurrency(db);
    const reminderChosen = useReminderChosen(db);
    const { state: settings } = useAppSettings();
    const option = settings.number("notificationOption");
    const hour = settings.number("notificationHour");
    const minute = settings.number("notificationMinute");
    const time = reminderTime(option, clampTimeOfDay(hour, minute));

    return (
        <View className="border-fr-rule bg-fr-card w-64 gap-1 rounded-3xl border px-5 py-4">
            <FlyleafLine quiet template={t("auth.signIn.begun")} value={flyleafDate(new Date(), language)} />
            <FlyleafLine
                template={t("auth.signIn.kept")}
                value={`${currency} ${currencyDisplayFor(currency).symbol}`}
            />
            {reminderChosen ? <FlyleafLine template={t("auth.signIn.written")} value={formatTimeOfDay(time)} /> : null}
        </View>
    );
}

function Agreement() {
    const t = useTranslation();
    const { language } = useLanguage();
    const [lead, middle, tail] = t("auth.signIn.agreement").split(PLACEHOLDER);
    return (
        <>
            {lead}
            <Text
                accessibilityRole="link"
                className="text-fr-ink underline"
                onPress={() => openBrowserAsync(legalUrl("terms", language))}
            >
                {t("settings.row.terms")}
            </Text>
            {middle}
            <Text
                accessibilityRole="link"
                className="text-fr-ink underline"
                onPress={() => openBrowserAsync(legalUrl("privacy", language))}
            >
                {t("settings.row.privacy")}
            </Text>
            {tail}
        </>
    );
}

function SignInContent({ client }: { client: AuthClient }) {
    const db = useDatabase();
    const t = useTranslation();
    const { busy, error, start } = useProviderSignIn(client, {
        onAppleFailure: async () => {
            await deferAccount(db);
            router.replace("/");
        },
    });

    return (
        <FirstRun
            body={t("auth.signIn.body")}
            error={error ?? null}
            eyebrow={t("auth.signIn.eyebrow")}
            footnote={
                <>
                    {t("auth.signIn.offline")}
                    {"\n"}
                    <Agreement />
                </>
            }
            object={<FlyleafCard />}
            skip={{
                label: t("auth.signIn.notNow"),
                onPress: () => {
                    deferAccount(db).catch((cause: unknown) => {
                        console.error("Deferring the account offer failed", cause);
                    });
                },
            }}
            title={t("auth.signIn.title")}
        >
            <ProviderSignInButtons
                busy={busy}
                fallbackClassName="text-fr-muted text-subtitle leading-snug"
                start={start}
            />
        </FirstRun>
    );
}
