import { Host } from "@expo/ui";
import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { Form, type TextFieldRef, useNativeState } from "@expo/ui/swift-ui";
import {
	animation,
	blur,
	listStyle,
	opacity,
	scrollContentBackground,
	scrollDismissesKeyboard,
} from "@expo/ui/swift-ui/modifiers";
import { useForm, useSelector } from "@tanstack/react-form";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { CurrencyPickerSheet } from "@/components/currency-picker-sheet";
import {
	CTA_BOTTOM_PADDING,
	CTA_HEIGHT,
	FLY_BACK,
	FLY_UP,
	FORM_BLUR_RADIUS,
	HEADER_HEIGHT,
	HERO_BOTTOM_PADDING,
	HERO_TOP_PADDING,
} from "@/components/editor-style";
import { holdSubmitting, pressSubmit } from "@/components/form/submit-guard";
import { IdentityCurtain } from "@/components/identity-curtain";
import { HERO_RING, IdentityFlyUpLayer } from "@/components/identity-fly-up";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useIdentityDraft, useIdentityFlyUp } from "@/contexts/identity-draft-context";
import { useDatabase } from "@/contexts/local-data-context";
import { type Account, accountsRepo, getAccountById } from "@/data/accounts-core";
import { useGlobalCurrency } from "@/data/app-meta";
import { toAccountKind } from "@/domain/account-kind";
import { formatAmount, minorUnitsFor, roundToMinorUnits } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { useAccountIdentity } from "@/hooks/use-account-identity";
import { useLocaleTag } from "@/hooks/use-locale-tag";
import { useRegionCode } from "@/hooks/use-region-code";
import { useLanguage, useTranslation } from "@/i18n/context";
import { ACCOUNT_DETENT, LARGE_ONLY } from "@/lib/sheet-detents";
import { useHaptics } from "@/lib/use-haptics";
import { glowFromEmoji } from "@/theme/glow";
import { useColors } from "@/theme/use-colors";
import { AccountEditorCta } from "./cta";
import { AccountEditorDetailsSection } from "./details-section";
import { AccountEditorHeroBand } from "./hero-band";

export type AccountEditorProps = { mode: "create" } | { mode: "edit"; id: string };

type IdentitySource = "initial" | "suggested" | "user";

export default function AccountEditor(props: AccountEditorProps) {
	const db = useDatabase();
	return <AccountEditorReady db={db} {...props} />;
}

/**
 * The add/edit account form: a FIXED hero header over a scrolling `Form`, the
 * exact shape of the category editor. The hero, the CTA and the mesh curtain
 * are RN views around the `Host`, because the `Form` inside it has to be its
 * only child.
 */
function curtainHuesFor(photoUri: string | null, emoji: string | null, tint: string): string[] {
	if (photoUri) {
		return [tint];
	}
	if (emoji) {
		return [...glowFromEmoji(emoji).slice(0, 2), tint];
	}
	return [tint];
}

function AccountEditorReady(props: AccountEditorProps & { db: import("@/db/client").Database }) {
	const { db, mode } = props;
	const editId = props.mode === "edit" ? props.id : null;
	const router = useRouter();
	const navigation = useNavigation();
	const t = useTranslation();
	const { language } = useLanguage();
	const colors = useColors();
	const haptics = useHaptics();
	const insets = useSafeAreaInsets();
	const globalCurrency = useGlobalCurrency(db);
	const aiEnrichment = useAppSettings().state.bool("aiEnrichment");
	const groundedLookup = useAppSettings().state.bool("groundedLookup");
	const locale = useLocaleTag();
	const regionCode = useRegionCode();

	const { draft, setDraft } = useIdentityDraft();
	const { pickerOpen, setPickerOpen, floatProgress } = useIdentityFlyUp();

	// Lazy `useState`, not `useMemo`: stable for the component's life — a
	// re-read would re-fire the draft effects below and clobber a picked logo.
	const [loaded] = useState<Account | null>(() =>
		mode === "edit" && editId != null ? getAccountById(db, editId) : null
	);

	const nameState = useNativeState(loaded?.name ?? "");
	const nameRef = useRef<TextFieldRef>(null);
	const currencySheetRef = useRef<BottomSheetModal>(null);
	const balanceSheetRef = useRef<BottomSheetModal>(null);

	const [initialValues] = useState(() => {
		const startingCurrency = loaded?.currency ?? globalCurrency;
		return {
			balanceText: numberToNumpad(Math.abs(loaded?.initialBalance ?? 0), minorUnitsFor(startingCurrency)),
			currency: startingCurrency,
			liability: toAccountKind(loaded?.kind) === "liability",
			name: loaded?.name ?? "",
			negative: (loaded?.initialBalance ?? 0) < 0,
		};
	});
	const form = useForm({
		defaultValues: initialValues,
		onSubmit: async ({ value }) => {
			// A currency swapped after typing can leave more precision in the pad
			// than the new code has minor units — JPY cannot hold "12.34".
			const magnitude = roundToMinorUnits(numpadToNumber(value.balanceText), value.currency);
			const input = {
				currency: value.currency,
				customColor: draft.color ?? null,
				emoji: draft.emoji ?? null,
				icon: draft.icon ?? null,
				imageColor: draft.photoColor ?? null,
				imageUri: draft.photoUri ?? null,
				initialBalance: value.negative ? -magnitude : magnitude,
				kind: value.liability ? ("liability" as const) : ("asset" as const),
				name: value.name.trim(),
			};
			try {
				if (mode === "create") {
					await accountsRepo.create(db, input);
				} else {
					if (loaded == null) {
						return;
					}
					await accountsRepo.update(db, loaded.id, input);
				}
				haptics("success");
				router.back();
				return await holdSubmitting();
			} catch {
				haptics("error");
				Alert.alert(
					t(mode === "create" ? "accounts.error.addTitle" : "accounts.error.saveTitle"),
					t("accounts.error.generic")
				);
			}
		},
	});
	const { name, currency, balanceText, negative, liability } = useSelector(form.store, (s) => s.values);
	const isSubmitting = useSelector(form.store, (s) => s.isSubmitting);

	const containerHeight = useSharedValue(0);
	const heroRestTop = useDerivedValue(() => HEADER_HEIGHT + HERO_TOP_PADDING);
	const [heroBand, setHeroBand] = useState(HEADER_HEIGHT + HERO_TOP_PADDING + HERO_RING + HERO_BOTTOM_PADDING);

	const [identitySource, setIdentitySource] = useState<IdentitySource>("initial");
	const identitySourceRef = useRef(identitySource);
	identitySourceRef.current = identitySource;
	const hasIdentityRef = useRef(false);
	hasIdentityRef.current = Boolean(draft.emoji || draft.icon || draft.photoUri);
	const pickerOpenRef = useRef(pickerOpen);
	pickerOpenRef.current = pickerOpen;

	// The draft is shared context, so this editor may mount onto another
	// screen's leftovers.
	useEffect(() => {
		if (mode !== "create") {
			return;
		}
		setDraft({
			color: null,
			emoji: null,
			icon: null,
			photoColor: null,
			photoUri: null,
		});
	}, [mode, setDraft]);

	useEffect(() => {
		if (mode !== "edit") {
			return;
		}
		setDraft(
			loaded
				? {
						color: loaded.customColor ?? null,
						emoji: loaded.emoji ?? null,
						icon: loaded.icon ?? null,
						photoColor: loaded.imageColor ?? null,
						photoUri: loaded.imageUri ?? null,
					}
				: {
						color: null,
						emoji: null,
						icon: null,
						photoColor: null,
						photoUri: null,
					}
		);
	}, [mode, loaded, setDraft]);

	useEffect(() => {
		navigation.setOptions({
			sheetAllowedDetents: pickerOpen ? LARGE_ONLY : [ACCOUNT_DETENT, 1],
		});
	}, [navigation, pickerOpen]);

	// The balance field raises a decimal pad, which has no return key, and the CTA
	// is pinned to the bottom — without this it is simply unreachable while typing.
	const keyboardLift = useSharedValue(0);
	useEffect(() => {
		const show = Keyboard.addListener("keyboardWillShow", (event) => {
			keyboardLift.value = withTiming(Math.max(0, event.endCoordinates.height - insets.bottom), {
				duration: event.duration,
			});
		});
		const hide = Keyboard.addListener("keyboardWillHide", (event) => {
			keyboardLift.value = withTiming(0, { duration: event.duration });
		});
		return () => {
			show.remove();
			hide.remove();
		};
	}, [insets.bottom, keyboardLift]);
	const ctaStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: -keyboardLift.value }],
	}));

	const identity = useAccountIdentity({
		canAttach: () =>
			identitySourceRef.current !== "user" &&
			!pickerOpenRef.current &&
			// An identity carried in from the stored row is a choice already made;
			// only an empty well or an earlier suggestion moves.
			!(identitySourceRef.current === "initial" && hasIdentityRef.current),
		enabled: mode === "create",
		groundedLookup,
		locale,
		onClear: () => {
			if (identitySourceRef.current !== "suggested") {
				return;
			}
			setIdentitySource("initial");
			setDraft((previous) => ({
				...previous,
				photoColor: null,
				photoUri: null,
			}));
		},
		onLogo: (logo) => {
			setIdentitySource("suggested");
			setDraft((previous) => ({
				...previous,
				photoColor: logo.imageColor,
				photoUri: logo.imageUri,
			}));
		},
		regionCode,
		remoteEnabled: aiEnrichment,
	});

	const onNameChange = (next: string) => {
		form.setFieldValue("name", next);
		identity.onNameChange(next);
	};

	const canSave = name.trim() !== "" && !isSubmitting;

	const tint = draft.photoColor ?? draft.color ?? colors.foreground;
	const symbolEmpty = !(draft.icon || draft.emoji || draft.photoUri);
	const curtainHues = symbolEmpty ? null : curtainHuesFor(draft.photoUri, draft.emoji, tint);

	const underPicker = [
		opacity(pickerOpen ? 0 : 1),
		blur(pickerOpen ? FORM_BLUR_RADIUS : 0),
		animation(pickerOpen ? FLY_UP : FLY_BACK, pickerOpen),
	];

	const openPicker = () => {
		Keyboard.dismiss();
		// Opening the picker claims the tile: a suggestion must not overwrite
		// whatever the user is about to choose.
		setIdentitySource("user");
		setPickerOpen(true);
		router.push("/transactions/identity");
	};

	const openCurrencyPicker = () => {
		Keyboard.dismiss();
		currencySheetRef.current?.present();
	};

	const openBalancePad = () => {
		Keyboard.dismiss();
		balanceSheetRef.current?.present();
	};

	return (
		<View
			onLayout={(e) => {
				containerHeight.value = e.nativeEvent.layout.height;
			}}
			style={{ backgroundColor: colors.groupedBackground, flex: 1 }}
		>
			<IdentityCurtain hues={curtainHues} />

			<View
				style={{
					flex: 1,
					paddingBottom: CTA_HEIGHT + CTA_BOTTOM_PADDING + insets.bottom,
					paddingTop: heroBand,
				}}
			>
				<Host style={{ flex: 1 }}>
					<Form
						modifiers={[
							listStyle("insetGrouped"),
							scrollContentBackground("hidden"),
							// The decimal pad has no return key and the CTA sits under it,
							// so a drag has to be able to put the keyboard away without
							// collapsing the sheet out from under the form.
							scrollDismissesKeyboard("immediately"),
							...underPicker,
						]}
					>
						<AccountEditorDetailsSection
							balanceEditA11y={t("accounts.a11y.editBalance")}
							balanceLabel={t("accounts.field.initialBalance")}
							balanceSignA11y={t("accounts.a11y.balanceSign")}
							balanceValue={formatAmount(numpadToNumber(balanceText), currency, true, language)}
							caption={mode === "edit" ? t("accounts.rebaseNote") : null}
							currencyCode={currency}
							currencyLabel={t("accounts.field.currency")}
							kindLabel={t("accounts.field.kind")}
							liability={liability}
							mutedColor={colors.muted}
							nameFieldRef={nameRef}
							nameLabel={t("accounts.field.name")}
							namePlaceholder={t("accounts.namePlaceholder")}
							nameState={nameState}
							negative={negative}
							onBalancePress={openBalancePad}
							onCurrencyPress={openCurrencyPicker}
							onNameChange={onNameChange}
							onSubmitName={() => pressSubmit(form)}
							onToggleLiability={(next) => form.setFieldValue("liability", next)}
							onToggleSign={() => form.setFieldValue("negative", !negative)}
							tintColor={colors.foreground}
						/>
					</Form>
				</Host>
			</View>

			<AccountEditorHeroBand
				captionClearance={0}
				color={tint}
				emoji={draft.emoji}
				floatProgress={floatProgress}
				icon={draft.icon}
				onLayout={(e) => setHeroBand(e.nativeEvent.layout.height)}
				onPress={openPicker}
				onReset={() => {
					setIdentitySource("user");
					setDraft({
						color: draft.color,
						emoji: null,
						icon: null,
						photoColor: null,
						photoUri: null,
					});
				}}
				photoUri={draft.photoUri}
			/>

			<Animated.View
				className="absolute right-0 bottom-safe-offset-2 left-0 px-5"
				pointerEvents="box-none"
				style={ctaStyle}
			>
				<AccountEditorCta
					canSave={canSave}
					label={t(mode === "create" ? "accounts.addAccount" : "accounts.saveAccount")}
					onPress={() => pressSubmit(form)}
					tintColor={colors.foreground}
					underPicker={underPicker}
				/>
			</Animated.View>

			<CurrencyPickerSheet
				onSelect={(code) => {
					form.setFieldValue("currency", code);
					currencySheetRef.current?.dismiss();
				}}
				ref={currencySheetRef}
				selected={currency}
			/>

			<AmountEntrySheet
				code={currency}
				minorUnits={minorUnitsFor(currency)}
				onChange={(next) => form.setFieldValue("balanceText", next)}
				onDone={() => balanceSheetRef.current?.dismiss()}
				ref={balanceSheetRef}
				value={balanceText}
			/>

			<IdentityFlyUpLayer
				color={tint}
				containerHeight={containerHeight}
				emoji={draft.emoji}
				icon={draft.icon}
				income={false}
				onDismiss={router.back}
				photoUri={draft.photoUri}
				restTop={heroRestTop}
				variant="transaction"
			/>
		</View>
	);
}

/** The edit route's toolbar needs the loaded name; expose the alert for it. */
export function confirmAccountDelete(
	db: import("@/db/client").Database,
	id: string,
	t: ReturnType<typeof useTranslation>,
	onDeleted: () => void
): void {
	const account = getAccountById(db, id);
	if (account == null) {
		return;
	}
	Alert.alert(t("accounts.delete.title", { name: account.name }), t("accounts.delete.message"), [
		{ style: "cancel", text: t("common.cancel") },
		{
			onPress: async () => {
				try {
					await accountsRepo.softDelete(db, id);
				} catch {
					Alert.alert(t("accounts.error.deleteTitle"), t("accounts.error.generic"));
					return;
				}
				onDeleted();
			},
			style: "destructive",
			text: t("common.delete"),
		},
	]);
}
