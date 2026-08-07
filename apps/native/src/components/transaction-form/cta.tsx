import { Stack, type StackHeaderItemSharedProps } from "expo-router";
import { type ToolbarIconName, toolbarIcon } from "@/components/toolbar-icons";

export interface TransactionFormCtaProps {
	saveLabel: string;
	canSave: boolean;
	onPress: () => void;
	deleteLabel?: string;
	deleteTint?: string;
	onDelete?: () => void;
}

export interface TransactionFormCtaAction {
	key: "delete" | "save";
	icon: ToolbarIconName;
	accessibilityLabel: string;
	disabled: boolean;
	onPress: () => void;
	separateBackground?: boolean;
	tintColor?: string;
	variant?: StackHeaderItemSharedProps["variant"];
}

export function transactionFormCtaActions({
	saveLabel,
	canSave,
	onPress,
	deleteLabel,
	deleteTint,
	onDelete,
}: TransactionFormCtaProps): TransactionFormCtaAction[] {
	const actions: TransactionFormCtaAction[] = [];
	// Destructive first, so the outermost item under the thumb is Save.
	if (onDelete) {
		actions.push({
			key: "delete",
			icon: "delete",
			accessibilityLabel: deleteLabel ?? "",
			disabled: false,
			tintColor: deleteTint,
			onPress: onDelete,
		});
	}

	actions.push({
		key: "save",
		icon: "done",
		accessibilityLabel: saveLabel,
		disabled: !canSave,
		onPress,
		variant: "done",
	});
	return actions;
}

export function TransactionFormCta(props: TransactionFormCtaProps) {
	return (
		<Stack.Toolbar placement="right">
			{transactionFormCtaActions(props).map((action) => (
				<Stack.Toolbar.Button
					{...toolbarIcon(action.icon)}
					accessibilityLabel={action.accessibilityLabel}
					disabled={action.disabled}
					key={action.key}
					onPress={action.onPress}
					tintColor={action.tintColor}
					variant={action.variant}
					separateBackground={action.separateBackground}
				/>
			))}
		</Stack.Toolbar>
	);
}
