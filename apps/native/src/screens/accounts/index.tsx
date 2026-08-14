import { Host } from "@expo/ui";
import {
	Button,
	HStack,
	Image,
	List,
	RNHostView,
	Section,
	Spacer,
	Text as SwiftText,
	SwipeActions,
	VStack,
} from "@expo/ui/swift-ui";
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityLabel,
	contentShape,
	font,
	foregroundStyle,
	lineLimit,
	monospacedDigit,
	onTapGesture,
	shapes,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback } from "react";
import { Alert, View } from "react-native";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { Eyebrow, LABEL, PARENT_NAME, PARENT_TILE } from "@/components/category-list-chrome";
import { EmptyState } from "@/components/empty-state";
import { Tile } from "@/components/empty-state-parts";
import { groupedList, groupedRows } from "@/components/native/styles";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccountBalance, useAccounts } from "@/data/accounts";
import { type Account, accountsRepo } from "@/data/accounts-core";
import type { Database } from "@/db/client";
import { formatSignedAmount, isMultiCurrency } from "@/domain/account-display";
import { useLanguage, useTranslation } from "@/i18n/context";
import { type ThemeColors, useColors } from "@/theme/use-colors";

const SUBTITLE = font({
	design: "rounded",
	textStyle: "subheadline",
});
const AMOUNT = font({
	design: "rounded",
	textStyle: "subheadline",
	weight: "medium",
});
const APPROX = font({
	design: "rounded",
	textStyle: "caption",
	weight: "semibold",
});
const CHEVRON = font({
	design: "rounded",
	textStyle: "footnote",
	weight: "semibold",
});

export function Accounts() {
	const db = useDatabase();
	return <AccountsReady db={db} />;
}

function AccountsReady({ db }: { db: Database }) {
	const router = useRouter();
	const t = useTranslation();
	const colors = useColors();
	const rows = useAccounts(db);
	const rowGround = groupedRows(colors);

	const openDetail = useCallback(
		(id: string) => {
			router.push({
				params: { accountId: id },
				pathname: "/settings/accounts/[accountId]",
			});
		},
		[router]
	);

	const confirmDelete = useCallback(
		(account: Account) => {
			Alert.alert(t("accounts.delete.title", { name: account.name }), t("accounts.delete.message"), [
				{ style: "cancel", text: t("common.cancel") },
				{
					onPress: () => {
						accountsRepo.softDelete(db, account.id).catch(() => {
							Alert.alert(t("accounts.error.deleteTitle"), t("accounts.error.generic"));
						});
					},
					style: "destructive",
					text: t("common.delete"),
				},
			]);
		},
		[db, t]
	);

	return (
		<>
			<Stack.Header transparent />
			<Stack.Screen.Title>{t("accounts.title")}</Stack.Screen.Title>
			<Stack.Screen.BackButton displayMode="minimal" />
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("reorder")}
					accessibilityLabel={t("accounts.a11y.reorder")}
					hidden={rows.length <= 1}
					onPress={() => router.push("/settings/accounts/reorder")}
				/>
			</Stack.Toolbar>
			{rows.length === 0 ? (
				<EmptyState body={t("accounts.empty")} mark={<AccountsMark />} tier="takeover" />
			) : (
				<Host style={{ flex: 1 }} useViewportSizeMeasurement>
					<List modifiers={groupedList(colors)}>
						<Section
							header={<Eyebrow colors={colors}>{t("accounts.census", { count: rows.length })}</Eyebrow>}
							modifiers={[rowGround]}
						>
							{rows.map((account) => (
								<AccountRow
									account={account}
									colors={colors}
									db={db}
									key={account.id}
									onDelete={confirmDelete}
									onOpen={openDetail}
								/>
							))}
						</Section>
						{rows.length >= 2 ? (
							<Section modifiers={[rowGround]}>
								<HStack
									modifiers={[
										contentShape(shapes.rectangle()),
										accessibilityLabel(t("transfers.a11y.new")),
										onTapGesture(() => router.push("/transactions/transfers/create")),
									]}
									spacing={12}
								>
									<Image color={colors.tint} size={18} systemName="arrow.left.arrow.right" />
									<SwiftText modifiers={[foregroundStyle(colors.tint)]}>{t("transfers.title")}</SwiftText>
									<Spacer />
								</HStack>
							</Section>
						) : null}
					</List>
				</Host>
			)}
		</>
	);
}

const MARK_TILE = 34;
const MARK_GAP = 11;

function AccountsMark() {
	return (
		<View className="flex-row items-center" style={{ gap: MARK_GAP }}>
			<Tile opacity={1} size={MARK_TILE} />
			<Tile opacity={0.6} size={MARK_TILE} />
			<Tile opacity={0.28} size={MARK_TILE} />
		</View>
	);
}

interface AccountRowProps {
	account: Account;
	colors: ThemeColors;
	db: Database;
	onDelete: (account: Account) => void;
	onOpen: (id: string) => void;
}

const AccountRow = memo(function AccountRowMemo({ account, colors, db, onDelete, onOpen }: AccountRowProps) {
	const t = useTranslation();
	const { language } = useLanguage();
	const { showCents } = useDisplaySettings().state;
	const balance = useAccountBalance(db, account);
	const subtitle = isMultiCurrency(balance.composition, account.currency)
		? t("accounts.multiCurrency")
		: account.currency;
	const tileColor = account.imageColor ?? account.customColor ?? colors.foreground;

	return (
		<SwipeActions>
			<HStack
				modifiers={[
					contentShape(shapes.rectangle()),
					onTapGesture(() => onOpen(account.id)),
					// An `onTapGesture` is invisible to VoiceOver: without these the row
					// is four loose strings and no way to open it.
					accessibilityElement("combine"),
					accessibilityAddTraits(["isButton"]),
					accessibilityLabel(
						`${account.name}, ${subtitle}, ${formatSignedAmount(balance.total, account.currency, showCents, language)}`
					),
				]}
				spacing={12}
			>
				<RNHostView matchContents>
					<View style={{ height: PARENT_TILE, width: PARENT_TILE }}>
						<CategoryIconTile
							color={tileColor}
							emoji={account.emoji}
							icon={account.icon}
							imageUri={account.imageUri}
							size={PARENT_TILE}
							type="solid"
						/>
					</View>
				</RNHostView>
				<VStack alignment="leading" spacing={1}>
					<SwiftText modifiers={[PARENT_NAME, lineLimit(1), foregroundStyle(LABEL)]}>{account.name}</SwiftText>
					<SwiftText modifiers={[SUBTITLE, lineLimit(1), foregroundStyle(colors.muted)]}>{subtitle}</SwiftText>
				</VStack>
				<Spacer />
				{balance.exact ? null : (
					<SwiftText modifiers={[APPROX, foregroundStyle(colors.subtle)]}>{`${account.currency}?`}</SwiftText>
				)}
				<SwiftText modifiers={[AMOUNT, monospacedDigit(), lineLimit(1), foregroundStyle(LABEL)]}>
					{formatSignedAmount(balance.total, account.currency, showCents, language)}
				</SwiftText>
				<Image color={colors.muted} modifiers={[CHEVRON]} systemName="chevron.right" />
			</HStack>
			<SwipeActions.Actions edge="trailing">
				{/* A `destructive` role makes SwiftUI animate the row out of the List on
				    press, before the confirmation is answered — and cancelling never
				    puts it back. The tint buys the same red without that. */}
				<Button
					label={t("common.delete")}
					modifiers={[tint(colors.danger)]}
					onPress={() => onDelete(account)}
					systemImage="trash"
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
});
