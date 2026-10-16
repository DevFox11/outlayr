import type { Ref } from "react";
import { View } from "react-native";
import type { TextInputInstance } from "react-native";

import { OutlinedDropdownField } from "@/components/material/outlined-dropdown-field";
import { OutlinedTextField } from "@/components/material/outlined-field";

type CategoryType = "expense" | "income";

interface CategoryDetailsFieldsProps {
    caption: string | null;
    /** A rejected save, shown in place of the caption. Null while the form is clean. */
    failure: string | null;
    expenseLabel: string;
    income: boolean;
    incomeLabel: string;
    name: string;
    nameFieldRef?: Ref<TextInputInstance>;
    nameLabel: string;
    namePlaceholder: string;
    onIncomeChange: (income: boolean) => void;
    onNameChange: (name: string) => void;
    onSubmitName: () => void;
    typeLabel: string;
    typePickerVisible: boolean;
}

/**
 * The category form as Material 3 outlined fields, for the Android editor
 * (`index.android.tsx`); the iOS one is the SwiftUI `details-section.tsx`.
 * The type dropdown draws through Compose, so only Android renders this.
 *
 * The name, with the caption or a rejected save as its supporting text, and
 * the expense/income type as a dropdown on a top-level create.
 */
export function CategoryDetailsFields({
    caption,
    failure,
    expenseLabel,
    income,
    incomeLabel,
    name,
    nameFieldRef,
    nameLabel,
    namePlaceholder,
    onIncomeChange,
    onNameChange,
    onSubmitName,
    typeLabel,
    typePickerVisible,
}: CategoryDetailsFieldsProps) {
    return (
        <View className="gap-4">
            {/* The failure takes the caption's slot: this is the line directly
			    below the name field, and it names what to change. */}
            <OutlinedTextField
                autoCapitalize="words"
                error={failure != null}
                label={nameLabel}
                onChangeText={onNameChange}
                onSubmitEditing={onSubmitName}
                placeholder={namePlaceholder}
                ref={nameFieldRef}
                returnKeyType="done"
                supportingText={failure ?? caption}
                value={name}
            />

            {typePickerVisible ? (
                <OutlinedDropdownField<CategoryType>
                    label={typeLabel}
                    onChange={(next) => onIncomeChange(next === "income")}
                    options={[
                        { label: expenseLabel, value: "expense" },
                        { label: incomeLabel, value: "income" },
                    ]}
                    value={income ? "income" : "expense"}
                />
            ) : null}
        </View>
    );
}
