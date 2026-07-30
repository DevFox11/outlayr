import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { currencyDisplayFor } from "@outlayr/money";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { CurrencyPickerSheet } from "@/components/currency-picker-sheet";
import { FirstRun } from "@/components/first-run";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { finishOnboarding } from "@/data/onboarding-core";
import { setCurrency } from "@/data/settings";
import type { Database } from "@/db/client";
import { useTranslation } from "@/i18n";

const EASE_OUT = Easing.bezier(0.19, 1, 0.22, 1);

/**
 * The stage object: the chosen currency's symbol at display size, flipping on
 * its vertical axis when the pick changes — the glyph turns over like a coin,
 * with the label swapped at the 90° edge where the face is invisible.
 */
function CurrencyGlyph({ symbol }: { symbol: string }) {
	const reduced = useReducedMotion();
	const [shown, setShown] = useState(symbol);
	const spin = useSharedValue(0);

	useEffect(() => {
		if (symbol === shown) {
			return;
		}
		if (reduced) {
			setShown(symbol);
			return;
		}
		const commit = (next: string) => {
			setShown(next);
			spin.value = -90;
			spin.value = withTiming(0, { duration: 320, easing: EASE_OUT });
		};
		spin.value = withTiming(
			90,
			{ duration: 160, easing: Easing.in(Easing.ease) },
			(finished) => {
				if (finished) {
					runOnJS(commit)(symbol);
				}
			},
		);
	}, [symbol, shown, reduced, spin]);

	const style = useAnimatedStyle(() => ({
		transform: [{ perspective: 600 }, { rotateY: `${spin.value}deg` }],
	}));

	return (
		<Animated.View style={style}>
			<Text
				adjustsFontSizeToFit
				className="w-56 text-center font-sans-bold text-[104px] text-fr-ink leading-[116px]"
				numberOfLines={1}
			>
				{shown}
			</Text>
		</Animated.View>
	);
}

export default function OnboardingCurrencyScreen() {
	const db = useDatabase();
	return <OnboardingCurrency db={db} />;
}

function OnboardingCurrency({ db }: { db: Database }) {
	const router = useRouter();
	const stored = useGlobalCurrency(db);
	const [picked, setPicked] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const sheet = useRef<BottomSheetModal>(null);
	const t = useTranslation();

	const code = picked ?? stored;
	const display = currencyDisplayFor(code);

	const fail = () => {
		setSaving(false);
		Alert.alert(
			t("onboarding.currency.saveFailed.title"),
			t("onboarding.currency.saveFailed.body"),
		);
	};

	const confirm = () => {
		setSaving(true);
		// The root guard does not swap on this write alone — rhythm is next, so
		// this screen has to push there itself.
		setCurrency(db, code)
			.then(() => router.push("/onboarding/rhythm"))
			.catch(fail);
	};

	const shortcut = () => {
		setSaving(true);
		// Nothing navigates on success here: `finishOnboarding` settles the root
		// guard, which swaps this stack for sign-in. Pushing as well would race it.
		setCurrency(db, code)
			.then(() => finishOnboarding(db))
			.catch(fail);
	};

	return (
		<FirstRun
			action={{
				disabled: saving,
				label: saving ? t("onboarding.currency.saving") : t("common.continue"),
				onPress: confirm,
			}}
			body={t("onboarding.currency.body")}
			eyebrow={t("onboarding.currency.eyebrow")}
			object={<CurrencyGlyph symbol={display.symbol} />}
			skip={{ label: t("onboarding.currency.shortcut"), onPress: shortcut }}
			title={t("onboarding.currency.title")}
		>
			<Pressable
				accessibilityHint={t("onboarding.currency.openHint")}
				accessibilityRole="button"
				className="flex-row items-center gap-3 rounded-2xl border border-fr-rule bg-fr-card px-4 py-3.5 active:opacity-60"
				onPress={() => sheet.current?.present()}
			>
				<Text className="w-8 text-center text-fr-muted text-headline">
					{display.symbol}
				</Text>
				<View className="flex-1 gap-0.5">
					<Text className="font-sans-semibold text-body text-fr-ink">
						{code}
					</Text>
					<Text className="text-footnote text-fr-muted" numberOfLines={1}>
						{display.name}
					</Text>
				</View>
				<MonoLabel className="text-fr-muted">
					{t("onboarding.currency.change")}
				</MonoLabel>
			</Pressable>

			<CurrencyPickerSheet
				onSelect={(next) => {
					setPicked(next);
					sheet.current?.dismiss();
				}}
				ref={sheet}
				selected={code}
			/>
		</FirstRun>
	);
}
