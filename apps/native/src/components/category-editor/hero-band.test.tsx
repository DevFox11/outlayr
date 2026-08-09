import { act, fireEvent, render } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import { CategoryEditorHeroBand } from "./hero-band";
import { HEADER_HEIGHT, HERO_BOTTOM_PADDING, HERO_TOP_PADDING } from "./style";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-sqlite", () => ({
	addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("@/contexts/local-data-context", () => ({
	useLocalData: () => ({ db: null }),
}));
jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		accent: "#3D7A5C",
		accentForeground: "#FFFFFF",
		background: "#F2F0EA",
		border: "#DAD6C9",
		danger: "#B5482F",
		expense: "#B5482F",
		foreground: "#17150F",
		future: "#8A8578",
		groupedBackground: "#EFEDE6",
		income: "#3D7A5C",
		muted: "#8A8578",
		overBudget: "#B5482F",
		railTrack: "rgba(0,0,0,0.08)",
		separator: "#DAD6C9",
		subtle: "#B4AFA0",
		surface: "#FFFFFF",
		surfaceSecondary: "#F7F5EF",
		tint: "#3D7A5C",
		warning: "#C08A2E",
	}),
}));

interface JsonNode {
	children: (JsonNode | string)[] | null;
	props: Record<string, unknown>;
	type: string;
}

function findByProp(node: JsonNode | JsonNode[] | null, key: string, value: unknown): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findByProp(child, key, value);
			if (found) {
				return found;
			}
		}
		return null;
	}
	if (node.props?.[key] === value) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const found = findByProp(child, key, value);
		if (found) {
			return found;
		}
	}
	return null;
}

interface HarnessProps {
	captionClearance?: number;
	color?: string;
	emoji?: string | null;
	icon?: string | null;
	income?: boolean;
	onLayout?: () => void;
	onPress?: () => void;
	onReset?: () => void;
}

function Harness({
	captionClearance = 0,
	color = "#3D7A5C",
	emoji = null,
	icon = null,
	income = false,
	onLayout = () => {},
	onPress = () => {},
	onReset = () => {},
}: HarnessProps) {
	const floatProgress = useSharedValue(0);
	return (
		<IdentityDraftProvider>
			<CategoryEditorHeroBand
				captionClearance={captionClearance}
				color={color}
				emoji={emoji}
				floatProgress={floatProgress}
				icon={icon}
				income={income}
				onLayout={onLayout}
				onPress={onPress}
				onReset={onReset}
			/>
		</IdentityDraftProvider>
	);
}

describe("CategoryEditorHeroBand", () => {
	it("renders without crashing in the empty state", async () => {
		const { toJSON } = await render(<Harness />);
		expect(toJSON()).toBeTruthy();
	});

	it("renders without crashing once an emoji is picked", async () => {
		const { toJSON } = await render(<Harness emoji="🎯" />);
		expect(toJSON()).toBeTruthy();
	});

	it("carries captionClearance into the wrapping view's bottom padding", async () => {
		const empty = await render(<Harness captionClearance={0} />);
		const filled = await render(<Harness captionClearance={24} />);

		const emptyRoot = findByProp(empty.toJSON() as JsonNode, "pointerEvents", "box-none");
		const filledRoot = findByProp(filled.toJSON() as JsonNode, "pointerEvents", "box-none");
		expect(emptyRoot).not.toBeNull();
		expect(filledRoot).not.toBeNull();

		const emptyStyle = (emptyRoot as JsonNode).props.style as {
			paddingBottom: number;
		};
		const filledStyle = (filledRoot as JsonNode).props.style as {
			paddingBottom: number;
		};
		expect(emptyStyle.paddingBottom).toBe(HERO_BOTTOM_PADDING);
		expect(filledStyle.paddingBottom).toBe(HERO_BOTTOM_PADDING + 24);
	});

	it("carries the header/top padding constants into the wrapping view", async () => {
		const { toJSON } = await render(<Harness />);
		const root = findByProp(toJSON() as JsonNode, "pointerEvents", "box-none");
		expect(root).not.toBeNull();
		const style = (root as JsonNode).props.style as { paddingTop: number };
		expect(style.paddingTop).toBe(HEADER_HEIGHT + HERO_TOP_PADDING);
	});

	it("fires onPress when the tile is tapped", async () => {
		const onPress = jest.fn();
		const { getByLabelText } = await render(<Harness onPress={onPress} />);
		fireEvent.press(getByLabelText("transaction.identity.hero.icon"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("fires onReset when the reset badge is tapped, only once a symbol is picked", async () => {
		const onReset = jest.fn();
		const { getByLabelText, queryByLabelText } = await render(<Harness emoji="🎯" onReset={onReset} />);
		expect(queryByLabelText("transaction.identity.hero.removeIcon")).not.toBeNull();
		fireEvent.press(getByLabelText("transaction.identity.hero.removeIcon"));
		expect(onReset).toHaveBeenCalledTimes(1);
	});

	it("has no reset target while the symbol is empty", async () => {
		const { queryByLabelText } = await render(<Harness />);
		expect(queryByLabelText("transaction.identity.hero.removeIcon")).toBeNull();
	});

	it("holds hook order across an empty -> filled -> empty re-render sequence", async () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const { rerender } = await render(<Harness emoji={null} icon={null} />);

		await act(async () => {
			rerender(<Harness emoji="🎯" icon={null} />);
		});
		await act(async () => {
			rerender(<Harness emoji="🚀" icon={null} />);
		});
		await act(async () => {
			rerender(<Harness emoji={null} icon={null} />);
		});

		const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
			typeof message === "string" ? /Rendered (more|fewer) hooks/.test(message) : false
		);
		expect(hookOrderViolations).toHaveLength(0);
		errorSpy.mockRestore();
	});

	it("holds hook order when income and color change together", async () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const { rerender } = await render(<Harness color="#3D7A5C" income={false} />);

		await act(async () => {
			rerender(<Harness color="#B5482F" income={true} />);
		});
		await act(async () => {
			rerender(<Harness color="#3D7A5C" income={false} />);
		});

		const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
			typeof message === "string" ? /Rendered (more|fewer) hooks/.test(message) : false
		);
		expect(hookOrderViolations).toHaveLength(0);
		errorSpy.mockRestore();
	});
});
