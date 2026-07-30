import { currencyDisplayFor } from "@outlayr/money";
import { Platform, View } from "react-native";
import { AppleSignInButton } from "@/components/account/apple-sign-in-button";
import { GoogleSignInButton } from "@/components/account/google-sign-in-button";
import { FirstRun } from "@/components/first-run";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { deferAccount, useReminderChosen } from "@/data/onboarding";
import { useNumberSetting } from "@/data/settings";
import { flyleafDate } from "@/domain/flyleaf";
import {
	clampTimeOfDay,
	formatTimeOfDay,
	reminderTime,
} from "@/domain/reminder";
import { useLanguage, useTranslation } from "@/i18n";
import { appleIdToken } from "@/lib/apple-sign-in";
import { authClient } from "@/lib/auth-client";
import { googleIdToken, isGoogleSignInAvailable } from "@/lib/google-sign-in";
import { useProviderSignIn } from "@/lib/use-provider-sign-in";

type AuthClient = NonNullable<typeof authClient>;

export default function SignInScreen() {
	return authClient ? <SignIn client={authClient} /> : <Unconfigured />;
}

/**
 * Renders an i18n template around its one value so the value can carry the
 * mono voice: words are said, figures are entered. The template arrives with
 * its placeholder intact — `t` leaves `{braces}` alone when no params are
 * passed — and is split here instead of interpolated.
 */
function FlyleafLine({
	template,
	value,
	quiet,
}: {
	template: string;
	value: string;
	quiet?: boolean;
}) {
	const [before, after] = template.split(/\{\w+\}/);
	// "Bs." + the template's own full stop would print "Bs.." — the value's
	// trailing period absorbs the sentence's.
	const tail =
		value.endsWith(".") && after?.startsWith(".") ? after.slice(1) : after;
	return (
		<Text
			className={
				quiet
					? "text-fr-muted text-label"
					: "font-sans-medium text-callout text-fr-ink leading-8"
			}
		>
			{before}
			<Text
				className={
					quiet
						? "font-mono text-fr-ink text-micro"
						: "font-mono-medium text-body text-fr-ink"
				}
				style={{ fontVariant: ["tabular-nums"] }}
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
	const option = useNumberSetting(db, "notificationOption");
	const hour = useNumberSetting(db, "notificationHour");
	const minute = useNumberSetting(db, "notificationMinute");
	const time = reminderTime(option, clampTimeOfDay(hour, minute));

	return (
		<View className="w-64 gap-1 rounded-3xl border border-fr-rule bg-fr-card px-5 py-4">
			<FlyleafLine
				quiet
				template={t("auth.signIn.begun")}
				value={flyleafDate(new Date(), language)}
			/>
			<FlyleafLine
				template={t("auth.signIn.kept")}
				value={`${currency} ${currencyDisplayFor(currency).symbol}`}
			/>
			{reminderChosen ? (
				<FlyleafLine
					template={t("auth.signIn.written")}
					value={formatTimeOfDay(time)}
				/>
			) : null}
		</View>
	);
}

function SignIn({ client }: { client: AuthClient }) {
	const db = useDatabase();
	const t = useTranslation();
	const { busy, error, start } = useProviderSignIn(client);
	const apple = Platform.OS === "ios";
	const google = isGoogleSignInAvailable;

	return (
		<FirstRun
			body={t("auth.signIn.body")}
			error={error ?? null}
			eyebrow={t("auth.signIn.eyebrow")}
			footnote={t("auth.signIn.offline")}
			object={<FlyleafCard />}
			skip={{
				label: t("auth.signIn.notNow"),
				onPress: () => {
					deferAccount(db).catch((failure: unknown) => {
						console.error("Deferring the account offer failed", failure);
					});
				},
			}}
			title={t("auth.signIn.title")}
		>
			<View className="gap-3">
				{apple ? (
					<AppleSignInButton
						disabled={busy !== null}
						onPress={() => start("apple", appleIdToken)}
						pending={busy === "apple"}
					/>
				) : null}
				{google ? (
					<GoogleSignInButton
						disabled={busy !== null}
						onPress={() => start("google", googleIdToken)}
						pending={busy === "google"}
					/>
				) : null}
				{apple || google ? null : (
					<Text className="text-fr-muted text-subtitle leading-snug">
						{t("settings.account.noProvider")}
					</Text>
				)}
			</View>
		</FirstRun>
	);
}

function Unconfigured() {
	const t = useTranslation();
	return (
		<FirstRun
			eyebrow={t("auth.unconfigured.eyebrow")}
			title={t("auth.unconfigured.title")}
		>
			<View className="border-fr-rule border-y py-5">
				<Text className="text-fr-muted text-subtitle leading-snug">
					{t("auth.unconfigured.body")}
				</Text>
			</View>
		</FirstRun>
	);
}
