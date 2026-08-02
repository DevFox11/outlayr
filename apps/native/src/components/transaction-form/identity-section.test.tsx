import { act, fireEvent, render } from "@testing-library/react-native";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import { TransactionFormIdentitySection } from "./identity-section";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
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
		background: "#F2F0EA",
		foreground: "#17150F",
		muted: "#8A8578",
		subtle: "#B4AFA0",
		surface: "#FFFFFF",
		surfaceSecondary: "#F7F5EF",
		groupedBackground: "#EFEDE6",
		border: "#DAD6C9",
		separator: "#DAD6C9",
		accent: "#3D7A5C",
		accentForeground: "#FFFFFF",
		tint: "#3D7A5C",
		income: "#3D7A5C",
		expense: "#B5482F",
		future: "#8A8578",
		danger: "#B5482F",
		overBudget: "#B5482F",
		warning: "#C08A2E",
		railTrack: "rgba(0,0,0,0.08)",
	}),
}));

interface JsonNode {
	type: string;
	props: Record<string, unknown>;
	children: (JsonNode | string)[] | null;
}

function findByStyleWidth(
	node: JsonNode | JsonNode[] | null,
	width: number,
): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findByStyleWidth(child, width);
			if (found) {
				return found;
			}
		}
		return null;
	}
	const style = node.props?.style as
		| { width?: number }
		| { width?: number }[]
		| undefined;
	const styles = Array.isArray(style) ? style : [style];
	if (styles.some((entry) => entry?.width === width)) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const found = findByStyleWidth(child, width);
		if (found) {
			return found;
		}
	}
	return null;
}

function findModifier(
	node: JsonNode | JsonNode[] | null,
	type: string,
): { $type: string; eventListener?: (args: unknown) => void } | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findModifier(child, type);
			if (found) {
				return found;
			}
		}
		return null;
	}
	const modifiers = node.props?.modifiers as
		| { $type: string; eventListener?: (args: unknown) => void }[]
		| undefined;
	const hit = modifiers?.find((modifier) => modifier.$type === type);
	if (hit) {
		return hit;
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const found = findModifier(child, type);
		if (found) {
			return found;
		}
	}
	return null;
}

interface HarnessProps {
	color?: string | null;
	contentWidth?: number;
	emoji?: string | null;
	icon?: string | null;
	income?: boolean;
	onPress?: () => void;
	onReset?: () => void;
	photoUri?: string | null;
}

function Harness({
	color = null,
	contentWidth = 335,
	emoji = null,
	icon = null,
	income = false,
	onPress = () => {},
	onReset = () => {},
	photoUri = null,
}: HarnessProps) {
	const floatProgress = useSharedValue(0);
	const heroWinY = useSharedValue(Number.NaN);
	return (
		<IdentityDraftProvider>
			<TransactionFormIdentitySection
				color={color}
				contentWidth={contentWidth}
				emoji={emoji}
				floatProgress={floatProgress}
				heroWinY={heroWinY}
				icon={icon}
				income={income}
				onPress={onPress}
				onReset={onReset}
				photoUri={photoUri}
			/>
		</IdentityDraftProvider>
	);
}

describe("TransactionFormIdentitySection", () => {
	it("renders without crashing in the empty state", async () => {
		const { toJSON } = await render(<Harness />);
		expect(toJSON()).toBeTruthy();
	});

	it("renders without crashing once a photo is set", async () => {
		const { toJSON } = await render(
			<Harness photoUri="file:///tmp/receipt.jpg" />,
		);
		expect(toJSON()).toBeTruthy();
	});

	it("carries contentWidth into the RNHostView-wrapped view's width", async () => {
		const narrow = await render(<Harness contentWidth={280} />);
		const wide = await render(<Harness contentWidth={734} />);
		expect(findByStyleWidth(narrow.toJSON() as JsonNode, 280)).not.toBeNull();
		expect(findByStyleWidth(wide.toJSON() as JsonNode, 734)).not.toBeNull();
	});

	it("fires onPress when the hero tile is tapped", async () => {
		const onPress = jest.fn();
		const { getByLabelText } = await render(<Harness onPress={onPress} />);
		fireEvent.press(getByLabelText("transaction.identity.hero.logo"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("fires onReset when the reset badge is tapped, only once an identity is set", async () => {
		const onReset = jest.fn();
		const { getByLabelText, queryByLabelText } = await render(
			<Harness emoji="🎯" onReset={onReset} />,
		);
		expect(
			queryByLabelText("transaction.identity.hero.removeLogo"),
		).not.toBeNull();
		fireEvent.press(getByLabelText("transaction.identity.hero.removeLogo"));
		expect(onReset).toHaveBeenCalledTimes(1);
	});

	it("wires the onGeometryChange modifier to write heroWinY", async () => {
		const heroWinY = { value: Number.NaN } as unknown as SharedValue<number>;
		function Probe() {
			const floatProgress = useSharedValue(0);
			return (
				<IdentityDraftProvider>
					<TransactionFormIdentitySection
						color={null}
						contentWidth={335}
						emoji={null}
						floatProgress={floatProgress}
						heroWinY={heroWinY}
						icon={null}
						income={false}
						onPress={() => {}}
						onReset={() => {}}
						photoUri={null}
					/>
				</IdentityDraftProvider>
			);
		}
		const { toJSON } = await render(<Probe />);
		const modifier = findModifier(toJSON() as JsonNode, "onGeometryChange");
		expect(modifier).not.toBeNull();

		modifier?.eventListener?.({ x: 0, y: 42, width: 335, height: 118 });
		expect(heroWinY.value).toBe(42);
	});

	it("holds hook order across an empty -> filled -> empty re-render sequence", async () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const { rerender } = await render(<Harness emoji={null} />);

		await act(async () => {
			rerender(<Harness emoji="🎯" />);
		});
		await act(async () => {
			rerender(<Harness emoji="🚀" income={true} />);
		});
		await act(async () => {
			rerender(<Harness emoji={null} income={false} />);
		});

		const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
			typeof message === "string"
				? /Rendered (more|fewer) hooks/.test(message)
				: false,
		);
		expect(hookOrderViolations).toHaveLength(0);
		errorSpy.mockRestore();
	});

	it("holds hook order across a contentWidth re-render (device rotation shape)", async () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const { rerender } = await render(<Harness contentWidth={335} />);

		await act(async () => {
			rerender(<Harness contentWidth={734} />);
		});
		await act(async () => {
			rerender(<Harness contentWidth={335} />);
		});

		const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
			typeof message === "string"
				? /Rendered (more|fewer) hooks/.test(message)
				: false,
		);
		expect(hookOrderViolations).toHaveLength(0);
		errorSpy.mockRestore();
	});
});
