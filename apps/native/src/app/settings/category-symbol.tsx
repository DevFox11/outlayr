import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { IdentityFlyUpSheetHost } from "@/components/identity-fly-up";
import {
	CATEGORY_TABS,
	IdentityPickerHost,
} from "@/components/identity-picker-content";
import { useIdentityDraft } from "@/contexts/identity-draft-context";
import { useDatabase } from "@/contexts/local-data-context";
import { CATEGORY_PALETTE, useCategoriesByNamespace } from "@/data/categories";
import { useColors } from "@/theme/use-colors";

/**
 * The sheet host drives the identity hero's flight and publishes this sheet's
 * measured height.
 */
export default function CategorySymbolScreen() {
	const db = useDatabase();
	const { draft, setDraft } = useIdentityDraft();
	const router = useRouter();
	const colors = useColors();
	const params = useLocalSearchParams<{
		income?: string;
		subcategory?: string;
		editId?: string;
	}>();
	const income = params.income === "1";
	const isSubcategory = params.subcategory === "1";
	const editId = params.editId && params.editId !== "" ? params.editId : null;

	const expenseTree = useCategoriesByNamespace(db, false);
	const usedColors = useMemo(() => {
		const set = new Set<string>();
		for (const node of expenseTree) {
			for (const category of [node, ...node.children]) {
				if (category.id === editId) {
					continue;
				}
				if (category.color) {
					set.add(category.color);
				}
			}
		}
		return Array.from(set);
	}, [expenseTree, editId]);

	const tint = income ? colors.income : (draft.color ?? CATEGORY_PALETTE[0]);

	return (
		<IdentityFlyUpSheetHost>
			<IdentityPickerHost
				onChange={setDraft}
				onDone={() => router.back()}
				// An income category takes the income green and a subcategory inherits
				// its parent's, so neither offers the rail.
				showsColorRail={!(income || isSubcategory)}
				tabs={CATEGORY_TABS}
				tint={tint}
				usedColors={usedColors}
				value={draft}
			/>
		</IdentityFlyUpSheetHost>
	);
}
