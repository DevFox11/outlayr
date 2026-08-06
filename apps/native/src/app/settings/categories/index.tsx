import { Host } from "@expo/ui";
import { Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { frame, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useToolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n";
import { Categories } from "@/screens/categories";

export default function CategoriesScreen() {
	const router = useRouter();
	const t = useTranslation();
	const [income, setIncome] = useState(false);
	const addIcon = useToolbarIcon("add");

	const goToNew = () => {
		router.push({
			pathname: "/settings/categories/create",
			params: { income: income ? "1" : "0" },
		});
	};

	return (
		<>
			<Stack.Toolbar placement="bottom">
				{/* The segmented picker draws its own capsule, so `hidesSharedBackground`
				    stops the toolbar wrapping it in a second glass one. */}
				<Stack.Toolbar.View hidesSharedBackground>
					<Host matchContents>
						<Picker
							label=""
							selection={income ? "income" : "expense"}
							onSelectionChange={(value) => setIncome(value === "income")}
							modifiers={[pickerStyle("segmented"), frame({ width: 190 })]}
						>
							<SwiftText modifiers={[tag("expense")]}>
								{t("common.expense")}
							</SwiftText>
							<SwiftText modifiers={[tag("income")]}>
								{t("common.income")}
							</SwiftText>
						</Picker>
					</Host>
				</Stack.Toolbar.View>
				<Stack.Toolbar.Spacer />
				<Stack.Toolbar.Button
					{...addIcon}
					accessibilityLabel={t("categories.a11y.new")}
					onPress={goToNew}
				/>
			</Stack.Toolbar>
			<Categories income={income} />
		</>
	);
}
