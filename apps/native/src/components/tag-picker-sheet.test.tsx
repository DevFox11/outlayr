import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { act, render } from "@testing-library/react-native";
import { createRef } from "react";
import { TagPickerSheet } from "./tag-picker-sheet";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
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

function containsText(
	node: JsonNode | JsonNode[] | null,
	text: string,
): boolean {
	if (node == null) {
		return false;
	}
	if (Array.isArray(node)) {
		return node.some((child) => containsText(child, text));
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			if (child === text) {
				return true;
			}
			continue;
		}
		if (containsText(child, text)) {
			return true;
		}
	}
	return false;
}

describe("TagPickerSheet", () => {
	it("lands ref on the BottomSheetModal", async () => {
		const ref = createRef<BottomSheetModal>();
		await render(
			<TagPickerSheet
				onCreate={async () => null}
				onToggle={() => {}}
				ref={ref}
				selected={[]}
				tags={[]}
			/>,
		);
		expect(ref.current).toBeTruthy();
	});

	it("offers a + Add affordance for each pending tag name not already a real tag", async () => {
		const ref = createRef<BottomSheetModal>();
		const { toJSON } = await render(
			<TagPickerSheet
				onCreate={async () => null}
				onToggle={() => {}}
				pendingTagNames={["Streaming", "Subscription"]}
				ref={ref}
				selected={[]}
				tags={[]}
			/>,
		);
		await act(async () => {
			ref.current?.present();
		});

		const tree = toJSON() as JsonNode;
		expect(
			containsText(tree, 'transaction.tags.create:{"name":"Streaming"}'),
		).toBe(true);
		expect(
			containsText(tree, 'transaction.tags.create:{"name":"Subscription"}'),
		).toBe(true);
	});

	it("does not offer a pending affordance for a name that already answers to a real tag", async () => {
		const ref = createRef<BottomSheetModal>();
		const { toJSON } = await render(
			<TagPickerSheet
				onCreate={async () => null}
				onToggle={() => {}}
				pendingTagNames={["Streaming"]}
				ref={ref}
				selected={[]}
				tags={[{ id: "t1", name: "Streaming", color: null, sortOrder: 0 }]}
			/>,
		);
		await act(async () => {
			ref.current?.present();
		});

		const tree = toJSON() as JsonNode;
		expect(
			containsText(tree, 'transaction.tags.create:{"name":"Streaming"}'),
		).toBe(false);
		expect(containsText(tree, "Streaming")).toBe(true);
	});
});
