export interface SwitchRowProps {
    label: string;
    value: boolean;
    onChange: (next: boolean) => void;
}

/**
 * A one-line M3 list item with a trailing Compose `Switch`, drawn by
 * `switch-row.android.tsx`. iOS has no Compose (`MaterialHost` throws there),
 * so this renders nothing; iOS forms use their SwiftUI `Toggle`.
 */
export function SwitchRow(_props: SwitchRowProps) {
    return null;
}
