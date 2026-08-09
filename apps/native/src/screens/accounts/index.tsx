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
	contentShape,
	font,
	foregroundStyle,
	lineLimit,
	listStyle,
	monospacedDigit,
	onTapGesture,
	shapes,
} from "@expo/ui/swift-ui/modifiers";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback } from "react";
import { Alert, View } from "react-native";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { Eyebrow, LABEL, PARENT_NAME, PARENT_TILE } from "@/components/category-list-chrome";
import { EmptyState } from "@/components/empty-state";
import { Tile } from "@/components/empty-state-parts";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccountBalance, useAccounts } from "@/data/accounts";
import { type Account, accountsRepo } from "@/data/accounts-core";
import type { Database } from "@/db/client";
import { formatSignedAmount, isMultiCurrency } from "@/domain/account-display";
import { useTranslation } from "@/i18n/context";
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
						accountsRepo.softDelete(db, account.id);
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
					<List modifiers={[listStyle("insetGrouped")]}>
						<Section header={<Eyebrow colors={colors}>{t("accounts.census", { count: rows.length })}</Eyebrow>}>
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

const AccountRow = memo(function AccountRowBody({ account, colors, db, onDelete, onOpen }: AccountRowProps) {
	const t = useTranslation();
	const { showCents } = useDisplaySettings().state;
	const balance = useAccountBalance(db, account);
	const subtitle = isMultiCurrency(balance.composition, account.currency)
		? t("accounts.multiCurrency")
		: account.currency;
	const tint = account.imageColor ?? account.customColor ?? colors.foreground;

	return (
		<SwipeActions>
			<HStack modifiers={[contentShape(shapes.rectangle()), onTapGesture(() => onOpen(account.id))]} spacing={12}>
				<RNHostView matchContents>
					<View style={{ height: PARENT_TILE, width: PARENT_TILE }}>
						<CategoryIconTile
							color={tint}
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
					{formatSignedAmount(balance.total, account.currency, showCents)}
				</SwiftText>
				<Image color={colors.muted} modifiers={[CHEVRON]} systemName="chevron.right" />
			</HStack>
			<SwipeActions.Actions edge="trailing">
				{/* biome-ignore lint/a11y/useValidAriaRole: @expo/ui Button `role` is a SwiftUI ButtonRole, not an ARIA role */}
				<Button label={t("common.delete")} onPress={() => onDelete(account)} role="destructive" systemImage="trash" />
			</SwipeActions.Actions>
		</SwipeActions>
	);
});
