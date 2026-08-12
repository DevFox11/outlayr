import { Host } from "@expo/ui";
import { HStack, List, Section, Spacer, Text as SwiftText } from "@expo/ui/swift-ui";
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityLabel,
	contentShape,
	foregroundStyle,
	listStyle,
	onTapGesture,
	shapes,
} from "@expo/ui/swift-ui/modifiers";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Alert } from "react-native";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import { useLiveQuery } from "@/data/live-query";
import { transfersRepo } from "@/data/transfers-core";
import { transactions, transfers } from "@/db/schema";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

const RATE_DECIMALS = 4;
const ROW_LABEL = foregroundStyle({ style: "secondary", type: "hierarchical" } as const);

export default function TransferDetail({ id }: { id: string }) {
	const db = useDatabase();
	const router = useRouter();
	const t = useTranslation();
	const { language } = useLanguage();
	const colors = useColors();
	const accounts = useAccounts(db);

	const rows = useLiveQuery(transfers, () => db.select().from(transfers).where(eq(transfers.id, id)), [id]);
	const feeRows = useLiveQuery(
		transactions,
		() => db.select().from(transactions).where(eq(transactions.transferId, id)),
		[id]
	);
	const transfer = rows[0] ?? null;
	const fee = feeRows.find((row) => row.deletedAt === null) ?? null;
	const names = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);

	if (!transfer) {
		return null;
	}

	const confirmDelete = () => {
		Alert.alert(t("transfers.delete.title"), t("transfers.delete.message"), [
			{ style: "cancel", text: t("common.cancel") },
			{
				onPress: async () => {
					await transfersRepo.softDelete(db, id);
					router.back();
				},
				style: "destructive",
				text: t("transfers.delete.confirm"),
			},
		]);
	};

	return (
		<Host style={{ flex: 1 }}>
			<List modifiers={[listStyle("insetGrouped")]}>
				<Section>
					<HStack>
						<SwiftText modifiers={[ROW_LABEL]}>{t("transfers.field.from")}</SwiftText>
						<Spacer />
						<SwiftText>{names.get(transfer.fromAccountId) ?? "—"}</SwiftText>
					</HStack>
					<HStack>
						<SwiftText modifiers={[ROW_LABEL]}>{t("transfers.detail.left")}</SwiftText>
						<Spacer />
						<SwiftText>{formatAmount(transfer.fromAmount, transfer.fromCurrency, true, language)}</SwiftText>
					</HStack>
					<HStack>
						<SwiftText modifiers={[ROW_LABEL]}>{t("transfers.field.to")}</SwiftText>
						<Spacer />
						<SwiftText>{names.get(transfer.toAccountId) ?? "—"}</SwiftText>
					</HStack>
					<HStack>
						<SwiftText modifiers={[ROW_LABEL]}>{t("transfers.detail.arrived")}</SwiftText>
						<Spacer />
						<SwiftText>{formatAmount(transfer.toAmount, transfer.toCurrency, true, language)}</SwiftText>
					</HStack>
				</Section>

				{transfer.fromCurrency === transfer.toCurrency ? null : (
					<Section>
						<HStack>
							<SwiftText modifiers={[ROW_LABEL]}>{t("transfers.field.rate")}</SwiftText>
							<Spacer />
							<SwiftText>{(transfer.exchangeRate ?? 0).toFixed(RATE_DECIMALS)}</SwiftText>
						</HStack>
						<HStack>
							<SwiftText modifiers={[ROW_LABEL]}>{t("transfers.detail.rateSource")}</SwiftText>
							<Spacer />
							<SwiftText>{transfer.exchangeRateType ?? "—"}</SwiftText>
						</HStack>
					</Section>
				)}

				{fee ? (
					<Section footer={<SwiftText>{t("transfers.detail.feeNote")}</SwiftText>}>
						<HStack>
							<SwiftText modifiers={[ROW_LABEL]}>{t("transfers.field.fee")}</SwiftText>
							<Spacer />
							<SwiftText>{formatAmount(fee.amount, fee.currency ?? transfer.fromCurrency, true, language)}</SwiftText>
						</HStack>
					</Section>
				) : null}

				<Section>
					{/* A `Button` here does not deliver its press inside a native List, so the row
					    carries its own hit area — and an `onTapGesture` is invisible to VoiceOver
					    without the accessibility modifiers that follow it. */}
					<HStack
						modifiers={[
							contentShape(shapes.rectangle()),
							onTapGesture(confirmDelete),
							accessibilityElement("combine"),
							accessibilityAddTraits(["isButton"]),
							accessibilityLabel(t("transfers.delete.row")),
						]}
					>
						<SwiftText modifiers={[foregroundStyle(colors.danger)]}>{t("transfers.delete.row")}</SwiftText>
						<Spacer />
					</HStack>
				</Section>
			</List>
		</Host>
	);
}
