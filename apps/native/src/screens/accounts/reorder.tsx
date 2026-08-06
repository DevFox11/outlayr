import { Host } from "@expo/ui";
import {
	HStack,
	List,
	RNHostView,
	Section,
	Spacer,
	Text as SwiftText,
} from "@expo/ui/swift-ui";
import {
	environment,
	foregroundStyle,
	lineLimit,
	listStyle,
} from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import { CategoryIconTile } from "@/components/category-icon-tile";
import {
	Eyebrow,
	LABEL,
	PARENT_NAME,
	PARENT_TILE,
} from "@/components/category-list-chrome";
import { useDatabase } from "@/contexts/local-data-context";
import { type Account, accountsRepo, useAccounts } from "@/data/accounts";
import type { Database } from "@/db/client";
import { applyMove } from "@/domain/reorder";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

export function AccountReorder() {
	const db = useDatabase();
	return <AccountReorderReady db={db} />;
}

function AccountReorderReady({ db }: { db: Database }) {
	const t = useTranslation();
	const colors = useColors();
	const rows = useAccounts(db);

	const reorder = (source: number[], destination: number) => {
		const ordered = applyMove(
			rows.map((account) => account.id),
			source,
			destination,
		);
		accountsRepo.reorder(db, ordered);
	};

	return (
		<Host style={{ flex: 1 }} useViewportSizeMeasurement>
			<List
				modifiers={[
					listStyle("insetGrouped"),
					environment({ key: "editMode", value: "active" }),
				]}
			>
				{/* A non-empty `title` short-circuits the `header` slot natively, so the
				    header passes the eyebrow instead of a plain string. */}
				<Section
					header={<Eyebrow colors={colors}>{t("accounts.title")}</Eyebrow>}
				>
					<List.ForEach onMove={reorder}>
						{rows.map((account) => (
							<ReorderRow
								account={account}
								key={account.id}
								tint={
									account.imageColor ?? account.customColor ?? colors.foreground
								}
							/>
						))}
					</List.ForEach>
				</Section>
			</List>
		</Host>
	);
}

function ReorderRow({ account, tint }: { account: Account; tint: string }) {
	return (
		<HStack spacing={12}>
			<RNHostView matchContents>
				<View style={{ width: PARENT_TILE, height: PARENT_TILE }}>
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
			<SwiftText
				modifiers={[PARENT_NAME, lineLimit(1), foregroundStyle(LABEL)]}
			>
				{account.name}
			</SwiftText>
			<Spacer />
		</HStack>
	);
}
