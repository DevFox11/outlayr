import { useState } from "react";
import { Pressable, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import {
	ADOPTION_CHOICES,
	type AdoptionChoice,
	isDestructiveChoice,
} from "@/domain/ledger-adoption";
import { type TranslationKey, useTranslation } from "@/i18n";
import { useLedgerAdoption } from "@/lib/ledger-adoption";

const COPY: Record<
	AdoptionChoice,
	{ title: TranslationKey; body: TranslationKey; confirm: TranslationKey }
> = {
	merge: {
		title: "auth.adopt.merge.title",
		body: "auth.adopt.merge.body",
		confirm: "auth.adopt.merge.body",
	},
	"keep-local": {
		title: "auth.adopt.keepLocal.title",
		body: "auth.adopt.keepLocal.body",
		confirm: "auth.adopt.confirm.keepLocal",
	},
	"keep-account": {
		title: "auth.adopt.keepAccount.title",
		body: "auth.adopt.keepAccount.body",
		confirm: "auth.adopt.confirm.keepAccount",
	},
};

export default function LedgerAdoptionScreen() {
	const { status, failed, choose } = useLedgerAdoption();
	const [confirming, setConfirming] = useState<AdoptionChoice | null>(null);
	const t = useTranslation();
	const working = status === "working";

	if (confirming) {
		return (
			<Frame
				body={t(COPY[confirming].confirm)}
				eyebrow={t("auth.adopt.eyebrow")}
				title={t("auth.adopt.confirm.title")}
			>
				<View className="gap-3">
					<Pressable
						accessibilityRole="button"
						className="items-center rounded-full bg-accent px-7 py-3.5 active:opacity-80 disabled:opacity-50"
						disabled={working}
						onPress={() => {
							setConfirming(null);
							choose("merge");
						}}
					>
						<Text className="font-sans-semibold text-accent-foreground text-body">
							{t("auth.adopt.confirm.cancel")}
						</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						className="items-center rounded-full border border-danger px-7 py-3.5 active:opacity-80 disabled:opacity-50"
						disabled={working}
						onPress={() => {
							const choice = confirming;
							setConfirming(null);
							choose(choice);
						}}
					>
						<Text className="font-sans-semibold text-body text-danger">
							{t("auth.adopt.confirm.proceed")}
						</Text>
					</Pressable>
				</View>
			</Frame>
		);
	}

	return (
		<Frame
			body={t("auth.adopt.body")}
			eyebrow={t("auth.adopt.eyebrow")}
			title={t("auth.adopt.title")}
		>
			<View className="border-border border-t">
				{ADOPTION_CHOICES.map((choice, index) => (
					<Pressable
						accessibilityRole="button"
						className="flex-row gap-4 border-border border-b py-5 active:opacity-60 disabled:opacity-50"
						disabled={working}
						key={choice}
						onPress={() => {
							if (isDestructiveChoice(choice)) {
								setConfirming(choice);
								return;
							}
							choose(choice);
						}}
					>
						<MonoLabel className="w-6 pt-1">
							{String(index + 1).padStart(2, "0")}
						</MonoLabel>
						<View className="flex-1 gap-1">
							<Text className="font-sans-semibold text-callout text-foreground">
								{t(COPY[choice].title)}
							</Text>
							<Text className="text-muted text-subtitle leading-snug">
								{t(COPY[choice].body)}
							</Text>
						</View>
					</Pressable>
				))}
			</View>

			{working ? (
				<Text className="pt-4 text-center text-muted text-subtitle">
					{t("auth.adopt.working")}
				</Text>
			) : null}
			{failed ? (
				<Text className="pt-4 text-danger text-subtitle leading-snug">
					{t("auth.adopt.failed")}
				</Text>
			) : null}
		</Frame>
	);
}

function Frame({
	eyebrow,
	title,
	body,
	children,
}: {
	eyebrow: string;
	title: string;
	body: string;
	children: React.ReactNode;
}) {
	return (
		<View className="flex-1 bg-background px-6 pt-safe-offset-14 pb-safe-offset-5">
			<View className="gap-2">
				<MonoLabel>{eyebrow}</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-title">
					{title}
				</Text>
				<Text className="text-muted text-subtitle leading-snug">{body}</Text>
			</View>

			<View className="flex-1 justify-center">{children}</View>
		</View>
	);
}
