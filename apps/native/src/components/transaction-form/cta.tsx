import { Stack, type StackHeaderItemSharedProps } from "expo-router";
import { type ToolbarIconName, toolbarIcon } from "@/components/toolbar-icons";

export interface TransactionFormCtaProps {
	canSave: boolean;
	deleteLabel?: string;
	deleteTint?: string;
	onDelete?: () => void;
	onPress: () => void;
	saveLabel: string;
}

export interface TransactionFormCtaAction {
	accessibilityLabel: string;
	disabled: boolean;
	icon: ToolbarIconName;
	key: "delete" | "save";
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
			accessibilityLabel: deleteLabel ?? "",
			disabled: false,
			icon: "delete",
			key: "delete",
			onPress: onDelete,
			tintColor: deleteTint,
		});
	}

	actions.push({
		accessibilityLabel: saveLabel,
		disabled: !canSave,
		icon: "done",
		key: "save",
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
					separateBackground={action.separateBackground}
					tintColor={action.tintColor}
					variant={action.variant}
				/>
			))}
		</Stack.Toolbar>
	);
}
