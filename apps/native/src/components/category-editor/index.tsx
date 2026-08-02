import { Host } from "@expo/ui";
import { Form, type TextFieldRef, useNativeState } from "@expo/ui/swift-ui";
import {
	animation,
	blur,
	listStyle,
	opacity,
	scrollContentBackground,
} from "@expo/ui/swift-ui/modifiers";
import { useNavigation, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, View } from "react-native";
import Animated, {
	FadeInDown,
	FadeOutDown,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IdentityCurtain } from "@/components/identity-curtain";
import { HERO_RING, IdentityFlyUpLayer } from "@/components/identity-fly-up";
import { Text } from "@/components/text";
import {
	useIdentityDraft,
	useIdentityFlyUp,
} from "@/contexts/identity-draft-context";
import { useDatabase } from "@/contexts/local-data-context";
import {
	CATEGORY_PALETTE,
	type Category,
	categoriesRepo,
	getCategoryById,
	useCategoriesByNamespace,
} from "@/data/categories";
import { firstAvailableColor } from "@/domain/category-color";
import {
	CATEGORY_ERROR_KEYS,
	categoryErrorCode,
} from "@/domain/category-error";
import { useTranslation } from "@/i18n";
import {
	CATEGORY_DETENT,
	LARGE_ONLY,
	SUBCATEGORY_DETENT,
} from "@/lib/sheet-detents";
import { useHaptics } from "@/lib/use-haptics";
import { glowFromEmoji } from "@/theme/glow";
import { withAlpha } from "@/theme/shade";
import { SYSTEM_COLORS, useColors } from "@/theme/use-colors";
import { CategoryEditorCta } from "./cta";
import { CategoryEditorDetailsSection } from "./details-section";
import { CategoryEditorHeroBand } from "./hero-band";
import {
	CAPTION_CLEARANCE,
	CTA_BOTTOM_PADDING,
	CTA_HEIGHT,
	FLY_BACK,
	FLY_UP,
	FORM_BLUR_RADIUS,
	HEADER_HEIGHT,
	HERO_BOTTOM_PADDING,
	HERO_TOP_PADDING,
} from "./style";

const MAX_EXPENSE_CATEGORIES = 24;

export type CategoryEditorProps =
	| { mode: "create"; income?: boolean; parentId?: string | null }
	| { mode: "edit"; id: string };

export default function CategoryEditor(props: CategoryEditorProps) {
	const db = useDatabase();
	return <CategoryEditorReady db={db} {...props} />;
}

/**
 * The add/edit category form: a FIXED hero header over a scrolling `Form`.
 *
 * The hero, the CTA and the mesh curtain are RN views around the `Host`, because
 * the `Form` inside it has to be its only child.
 */
function CategoryEditorReady(
	props: CategoryEditorProps & { db: import("@/db/client").Database },
) {
	const { db } = props;
	// Stable per-instance primitives: the parent spreads a fresh `props` object
	// every render, so effects must key off these, never off `props` itself.
	const mode = props.mode;
	const parentId = props.mode === "create" ? (props.parentId ?? null) : null;
	const editId = props.mode === "edit" ? props.id : null;
	const initialIncome = props.mode === "create" ? !!props.income : false;
	const router = useRouter();
	const navigation = useNavigation();
	const t = useTranslation();
	const colors = useColors();
	const haptics = useHaptics();
	const insets = useSafeAreaInsets();

	const { draft, setDraft } = useIdentityDraft();
	const { pickerOpen, setPickerOpen, floatProgress } = useIdentityFlyUp();

	// Lazy `useState`, not `useMemo`: these must be stable for the component's
	// life — a re-read would re-fire the draft effects below and clobber whatever
	// the user has since picked.
	const [loaded] = useState<Category | null>(() =>
		mode === "edit" && editId != null ? getCategoryById(db, editId) : null,
	);
	const [parent] = useState<Category | null>(() =>
		mode === "create" && parentId != null
			? getCategoryById(db, parentId)
			: null,
	);

	const nameState = useNativeState(loaded?.name ?? "");
	const nameRef = useRef<TextFieldRef>(null);

	const [name, setName] = useState(loaded?.name ?? "");
	const [colorTouched, setColorTouched] = useState(false);
	const [createIncome, setCreateIncome] = useState(
		parent?.income ?? initialIncome,
	);
	const [saving, setSaving] = useState(false);
	const [showToast, setShowToast] = useState(false);
	const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// A shared value, not state: only the fly-up reads it and it does so from the
	// UI thread, so measuring must not cost the form a render.
	const containerHeight = useSharedValue(0);
	// Nothing to measure: this hero is FIXED, so where its ring rests is the
	// padding above it and nothing else.
	const heroRestTop = useDerivedValue(() => HEADER_HEIGHT + HERO_TOP_PADDING);
	/**
	 * The hero band's real height, measured rather than derived: it turns on the
	 * caption's rendered line height, and the caption itself comes and goes.
	 */
	const [heroBand, setHeroBand] = useState(
		HEADER_HEIGHT + HERO_TOP_PADDING + HERO_RING + HERO_BOTTOM_PADDING,
	);

	const expenseTree = useCategoriesByNamespace(db, false);

	const allExpense = useMemo(
		() => expenseTree.flatMap((node) => [node, ...node.children]),
		[expenseTree],
	);
	const expenseCount = allExpense.length;
	const usedColors = useMemo(() => {
		const set = new Set<string>();
		for (const category of allExpense) {
			if (category.id === editId) {
				continue;
			}
			if (category.color) {
				set.add(category.color);
			}
		}
		return set;
	}, [allExpense, editId]);

	// The draft is shared context, so a create editor may mount onto another
	// screen's leftovers.
	useEffect(() => {
		if (mode !== "create") {
			return;
		}
		setDraft({
			emoji: null,
			icon: null,
			photoUri: null,
			photoColor: null,
			color: null,
		});
	}, [mode, setDraft]);

	// Seeded with the raw icon/emoji, not the resolved fallback, so an unknown
	// glyph is not silently rewritten on save.
	useEffect(() => {
		if (mode !== "edit") {
			return;
		}
		setDraft(
			loaded
				? {
						emoji: loaded.emoji ?? null,
						icon: loaded.icon ?? null,
						photoUri: null,
						photoColor: null,
						color: loaded.color ?? CATEGORY_PALETTE[0],
					}
				: {
						emoji: null,
						icon: null,
						photoUri: null,
						photoColor: null,
						color: null,
					},
		);
	}, [mode, loaded, setDraft]);

	useEffect(() => {
		if (mode !== "create" || parent == null) {
			return;
		}
		setDraft({
			emoji: null,
			icon: null,
			photoUri: null,
			photoColor: null,
			color: parent.color ?? CATEGORY_PALETTE[0],
		});
	}, [mode, parent, setDraft]);

	useEffect(
		() => () => {
			if (toastTimer.current != null) {
				clearTimeout(toastTimer.current);
			}
		},
		[],
	);

	const isSubcategory =
		mode === "create" ? parentId != null : (loaded?.parentId ?? null) != null;
	const income = mode === "create" ? createIncome : (loaded?.income ?? false);
	const atExpenseLimit = expenseCount >= MAX_EXPENSE_CATEGORIES;

	// The sheet grows to `.large` before the picker is presented: a 430pt picker
	// over the medium detent would cover the whole parent, hero included, leaving
	// nothing for the fly-up to land on.
	//
	// This is also where the sheet learns it is a SUBCATEGORY and opens shorter:
	// the route options are static, and only the editor resolves the parent.
	useEffect(() => {
		navigation.setOptions({
			sheetAllowedDetents: pickerOpen
				? LARGE_ONLY
				: [isSubcategory ? SUBCATEGORY_DETENT : CATEGORY_DETENT, 1],
		});
	}, [navigation, pickerOpen, isSubcategory]);

	useEffect(() => {
		if (mode !== "create" || parentId != null || colorTouched) {
			return;
		}
		const next = firstAvailableColor(usedColors);
		if (draft.color === next) {
			return;
		}
		setDraft({
			emoji: null,
			icon: null,
			photoUri: null,
			photoColor: null,
			color: next,
		});
	}, [mode, parentId, colorTouched, usedColors, draft.color, setDraft]);

	useEffect(() => {
		if (mode !== "create" || parentId != null) {
			return;
		}
		if (atExpenseLimit) {
			setCreateIncome(true);
		}
	}, [mode, parentId, atExpenseLimit]);

	// An add that fills the expense namespace closes the sheet. Keyed on the count
	// CHANGING, not on its value — firing on mount would race the force-income
	// effect above and close a sheet that was about to become an income one.
	const seenExpenseCount = useRef(expenseCount);
	useEffect(() => {
		const changed = expenseCount !== seenExpenseCount.current;
		seenExpenseCount.current = expenseCount;
		if (
			changed &&
			mode === "create" &&
			parentId == null &&
			!income &&
			expenseCount >= MAX_EXPENSE_CATEGORIES
		) {
			router.back();
		}
	}, [expenseCount, mode, parentId, income, router]);

	const symbolEmpty = !draft.icon && !draft.emoji;
	const captionClearance = symbolEmpty ? CAPTION_CLEARANCE : 0;
	const tint = income ? colors.income : (draft.color ?? CATEGORY_PALETTE[0]);
	const curtainHues = symbolEmpty
		? null
		: draft.emoji
			? [...glowFromEmoji(draft.emoji).slice(0, 2), tint]
			: [tint];
	const typePickerVisible =
		mode === "create" && !isSubcategory && !atExpenseLimit;

	const valid =
		mode === "create"
			? name.trim() !== "" && !symbolEmpty
			: name.trim() !== "" &&
				(!symbolEmpty ||
					(loaded != null && loaded.icon == null && loaded.emoji == null));
	const canSave = valid && !saving;

	const namePlaceholder = t(
		isSubcategory
			? "categories.namePlaceholder.subcategory"
			: income
				? "categories.namePlaceholder.income"
				: "categories.namePlaceholder.expense",
	);

	const caption =
		mode === "create"
			? isSubcategory
				? parent
					? t("categories.inherits", { parent: parent.name })
					: null
				: income
					? t("categories.incomeColorNote")
					: null
			: null;

	const ctaLabel = t(
		mode === "create"
			? isSubcategory
				? "categories.addSubcategory"
				: "categories.addCategory"
			: isSubcategory
				? "categories.saveSubcategory"
				: "categories.saveCategory",
	);
	const errorTitle = t(
		mode === "create"
			? "categories.error.addTitle"
			: "categories.error.saveTitle",
	);

	// The form and the CTA carry these themselves instead of sharing a wrapper
	// stack: a `Form` one level deeper is proposed no height and collapses to
	// nothing, taking every row with it.
	const underPicker = [
		opacity(pickerOpen ? 0 : 1),
		blur(pickerOpen ? FORM_BLUR_RADIUS : 0),
		animation(pickerOpen ? FLY_UP : FLY_BACK, pickerOpen),
	];

	const openPicker = () => {
		// Or the keyboard is left standing over the picker about to be presented.
		Keyboard.dismiss();
		// Freezes the auto-color so a color picked in the picker survives.
		setColorTouched(true);
		// On the tap frame, rather than waiting for the picker route to mount.
		setPickerOpen(true);
		router.push({
			pathname: "/settings/category-symbol",
			params: {
				income: income ? "1" : "0",
				subcategory: isSubcategory ? "1" : "0",
				editId: editId ?? "",
			},
		});
	};

	/** Back-to-back adds must not let the first timer clear the second flash. */
	const flashAdded = () => {
		if (toastTimer.current != null) {
			clearTimeout(toastTimer.current);
		}
		setShowToast(true);
		toastTimer.current = setTimeout(() => setShowToast(false), 2000);
	};

	const submit = async () => {
		if (saving) {
			return;
		}
		setSaving(true);
		try {
			if (mode === "create") {
				const saveColor = income
					? colors.income
					: isSubcategory
						? (parent?.color ?? draft.color ?? CATEGORY_PALETTE[0])
						: (draft.color ?? CATEGORY_PALETTE[0]);
				await categoriesRepo.create(db, {
					name,
					icon: draft.icon ?? undefined,
					emoji: draft.emoji ?? null,
					color: saveColor,
					income,
					parentId,
				});
				haptics("success");
				// A top-level add stays put for a run of them; a subcategory returns to
				// the row it was added from.
				if (isSubcategory) {
					router.back();
					return;
				}
				nameState.set("");
				setName("");
				// Cleared rather than advanced here: with `colorTouched` released, the
				// auto-color effect assigns the first free slot AFTER this insert has
				// landed, where a value chosen now comes from the pre-insert set.
				setColorTouched(false);
				setDraft({
					emoji: null,
					icon: null,
					photoUri: null,
					photoColor: null,
					color: null,
				});
				flashAdded();
				setSaving(false);
				return;
			}
			if (loaded == null) {
				setSaving(false);
				return;
			}
			await categoriesRepo.update(db, loaded.id, {
				name,
				icon: draft.icon ?? null,
				emoji: draft.emoji ?? null,
				color: income ? undefined : (draft.color ?? CATEGORY_PALETTE[0]),
			});
			haptics("success");
			router.back();
		} catch (error) {
			haptics("error");
			const code =
				error instanceof Error ? categoryErrorCode(error.message) : null;
			const message = code
				? t(CATEGORY_ERROR_KEYS[code])
				: t("categories.error.generic");
			const refocus = code === "missingName" || code === "duplicateName";
			Alert.alert(errorTitle, message, [
				{
					text: t("categories.ok"),
					onPress: refocus ? () => nameRef.current?.focus() : undefined,
				},
			]);
			setSaving(false);
		}
	};

	return (
		<View
			onLayout={(e) => {
				containerHeight.value = e.nativeEvent.layout.height;
			}}
			style={{
				flex: 1,
				backgroundColor: SYSTEM_COLORS.groupedBackground,
			}}
		>
			{/* FIRST in the tree so it paints under the form: the `Form`'s own
			    background is hidden, so the wash reads through the gaps while the
			    opaque cells cover it. */}
			<IdentityCurtain hues={curtainHues} />

			{/* The `Form` has to be its host's ONLY child — nested any deeper it is
			    proposed no height and collapses, rows and all — so the hero and CTA
			    are RN views laid over the space this padding reserves. The padding is
			    on the wrapper, not the `Host`: under `useViewportSizeMeasurement` the
			    host lays its SwiftUI content out against the viewport and its own
			    padding is ignored. */}
			<View
				style={{
					flex: 1,
					paddingTop: heroBand,
					paddingBottom: CTA_HEIGHT + CTA_BOTTOM_PADDING + insets.bottom,
				}}
			>
				<Host style={{ flex: 1 }}>
					<Form
						modifiers={[
							listStyle("insetGrouped"),
							scrollContentBackground("hidden"),
							...underPicker,
						]}
					>
						<CategoryEditorDetailsSection
							caption={caption}
							expenseLabel={t("common.expense")}
							income={income}
							incomeLabel={t("common.income")}
							nameFieldRef={nameRef}
							nameLabel={t("categories.field.name")}
							namePlaceholder={namePlaceholder}
							nameState={nameState}
							onIncomeChange={setCreateIncome}
							onNameChange={setName}
							onSubmitName={submit}
							tintColor={colors.foreground}
							typeLabel={t("categories.field.type")}
							typePickerVisible={typePickerVisible}
						/>
					</Form>
				</Host>
			</View>

			{/* Follows the `Host` in the tree so the header's scroll-edge lookup still
			    finds the form first. */}
			<CategoryEditorHeroBand
				captionClearance={captionClearance}
				color={tint}
				emoji={draft.emoji}
				floatProgress={floatProgress}
				icon={draft.icon}
				income={income}
				onLayout={(e) => setHeroBand(e.nativeEvent.layout.height)}
				onPress={openPicker}
				onReset={() =>
					setDraft({
						emoji: null,
						icon: null,
						photoUri: null,
						photoColor: null,
						color: null,
					})
				}
			/>

			<View
				pointerEvents="box-none"
				className="absolute right-0 bottom-safe-offset-2 left-0 px-5"
			>
				<CategoryEditorCta
					canSave={canSave}
					label={ctaLabel}
					onPress={submit}
					tintColor={colors.foreground}
					underPicker={underPicker}
				/>
			</View>

			{showToast ? (
				<Animated.View
					entering={FadeInDown.springify()}
					exiting={FadeOutDown}
					pointerEvents="none"
					className="absolute right-0 bottom-safe-offset-5 left-0 items-center"
				>
					<View
						className="flex-row items-center gap-2 rounded-full"
						style={{
							paddingHorizontal: 16,
							paddingVertical: 10,
							backgroundColor: SYSTEM_COLORS.card,
							borderWidth: 1,
							borderColor: withAlpha(colors.foreground, 0.12),
						}}
					>
						<SymbolView
							name="checkmark.circle.fill"
							size={15}
							tintColor={colors.income}
							type="monochrome"
						/>
						<Text className="font-sans-semibold text-caption text-income">
							{t("categories.toast.added")}
						</Text>
					</View>
				</Animated.View>
			) : null}

			<IdentityFlyUpLayer
				color={tint}
				containerHeight={containerHeight}
				emoji={draft.emoji}
				icon={draft.icon}
				income={income}
				onDismiss={router.back}
				photoUri={null}
				restTop={heroRestTop}
				variant="category"
			/>
		</View>
	);
}
