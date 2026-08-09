import { act, fireEvent, render } from "@testing-library/react-native";
import { createRef, type ReactNode } from "react";
import { importDraftStore } from "@/lib/import-draft-store";
import { ImportSheet, type ImportSheetHandle, resolveLegalStep } from "./import-sheet";

const mockPush = jest.fn();
const mockDismiss = jest.fn();
const mockSnapToIndex = jest.fn();
const mockSheetProps: Record<string, unknown>[] = [];
const mockDismissHolder: { current?: () => void } = {};

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("uniwind", () => ({
	...jest.requireActual("uniwind"),
	useCSSVariable: () => "#F2F0EA",
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		background: "#F2F0EA",
		foreground: "#17150F",
		muted: "#8A8578",
	}),
}));
jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 59 }),
}));
jest.mock("@expo/ui/community/bottom-sheet", () => {
	const { View: RNView } = require("react-native");
	const { useImperativeHandle } = require("react");
	return {
		BottomSheetModal: ({
			children,
			ref,
			onDismiss,
			...rest
		}: {
			children: ReactNode;
			ref?: React.Ref<unknown>;
			onDismiss?: () => void;
		}) => {
			mockSheetProps.push(rest as Record<string, unknown>);
			mockDismissHolder.current = onDismiss;
			useImperativeHandle(ref, () => ({
				dismiss: mockDismiss,
				present: jest.fn(),
				snapToIndex: mockSnapToIndex,
			}));
			return <RNView testID="bottom-sheet-modal">{children}</RNView>;
		},
	};
});
jest.mock("@/contexts/csv-import-context", () => ({
	CsvImportProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("@/hooks/use-import-review", () => ({
	useImportReview: () => ({
		categoryName: new Map(),
		categoryTile: new Map(),
		commit: { phase: "idle" },
		currency: "USD",
		excluded: new Set(),
		onCommit: jest.fn(),
		onToggle: jest.fn(),
		plan: { earliest: null, entries: [], latest: null, skipped: [] },
		rows: [],
		selectedCount: 0,
	}),
}));
jest.mock("./use-choose-import-file", () => ({
	useChooseImportFile: () => ({ choose: jest.fn(), status: "idle" }),
}));
jest.mock("./steps/source-step", () => {
	const { Text: RNText } = require("react-native");
	return { SourceStep: () => <RNText>step:source</RNText> };
});
jest.mock("./steps/file-step", () => {
	const { Text: RNText } = require("react-native");
	return { FileStep: () => <RNText>step:file</RNText> };
});
jest.mock("./steps/resolve-step", () => {
	const { Text: RNText } = require("react-native");
	return { ResolveStep: () => <RNText>step:resolve</RNText> };
});
jest.mock("./steps/review-step", () => {
	const { Text: RNText } = require("react-native");
	return { ReviewStep: () => <RNText>step:review</RNText> };
});
jest.mock("./steps/done-step", () => {
	const { Text: RNText } = require("react-native");
	return { DoneStep: () => <RNText>step:done</RNText> };
});

function loadFile() {
	importDraftStore.dispatch({ sourceId: "csv", type: "sourceSelected" });
	importDraftStore.dispatch({
		draft: {
			amount: 2,
			category: 0,
			currency: null,
			date: 0,
			note: 1,
			type: null,
		},
		file: { chars: 42, name: "bank.csv" },
		gaps: [],
		parsed: { header: null, rows: [["a", "b", "c"]], width: 3 },
		resolved: {
			labelSource: "categoryColumn",
			mapping: {
				amount: 2,
				category: 0,
				currency: null,
				date: 0,
				note: 1,
				type: null,
			},
		},
		type: "fileParsed",
	});
}

async function presentSheet() {
	const ref = createRef<ImportSheetHandle>();
	const screen = await render(<ImportSheet ref={ref} />);
	await act(async () => {
		ref.current?.present();
	});
	return { ref, ...screen };
}

describe("resolveLegalStep", () => {
	it("falls back to the earliest legal step when guards fail", () => {
		const empty = importDraftStore.getSnapshot().flow;
		expect(resolveLegalStep(empty, "review")).toBe("source");
		expect(resolveLegalStep(empty, "done")).toBe("source");
		expect(resolveLegalStep(empty, "source")).toBe("source");
	});

	it("lets a legal step through", () => {
		importDraftStore.clear();
		loadFile();
		const flow = importDraftStore.getSnapshot().flow;
		expect(resolveLegalStep(flow, "file")).toBe("file");
		expect(resolveLegalStep(flow, "resolve")).toBe("resolve");
		expect(resolveLegalStep(flow, "review")).toBe("resolve");
		importDraftStore.clear();
	});
});

describe("ImportSheet", () => {
	beforeEach(() => {
		importDraftStore.clear();
		mockSheetProps.length = 0;
		mockPush.mockClear();
		mockDismiss.mockClear();
		mockSnapToIndex.mockClear();
	});

	it("configures the modal: dynamic sizing, pan-down close, near-opaque paper background", async () => {
		await presentSheet();
		const props = mockSheetProps.at(-1) as Record<string, unknown>;
		expect(props.snapPoints).toBeUndefined();
		expect(props.enableDynamicSizing).toBe(true);
		expect(props.enablePanDownToClose).toBe(true);
		expect(props.backgroundStyle).toStrictEqual({
			backgroundColor: "#F2F0EAFA",
		});
	});

	it("mounts no step content before it is presented", async () => {
		const ref = createRef<ImportSheetHandle>();
		const { queryByText } = await render(<ImportSheet ref={ref} />);
		expect(queryByText("step:source")).toBeNull();
	});

	it("presents the source step with its title and no back chevron", async () => {
		const { findByText, queryByTestId } = await presentSheet();
		expect(await findByText("step:source")).toBeTruthy();
		expect(await findByText("import.titleSource")).toBeTruthy();
		expect(queryByTestId("import-sheet-back")).toBeNull();
	});

	it("guards an illegal stored step back to the earliest legal one", async () => {
		importDraftStore.setStep("review");
		const { findByText } = await presentSheet();
		expect(await findByText("step:source")).toBeTruthy();
	});

	it("renders the file step with a back chevron that steps back through the store", async () => {
		loadFile();
		importDraftStore.setStep("file");
		const { findByText, getByTestId } = await presentSheet();
		expect(await findByText("step:file")).toBeTruthy();

		fireEvent.press(getByTestId("import-sheet-back"));
		expect(importDraftStore.getSnapshot().ui.step).toBe("source");
	});

	it("dismisses through the close button", async () => {
		const { getByTestId } = await presentSheet();
		fireEvent.press(getByTestId("import-sheet-close"));
		expect(mockDismiss).toHaveBeenCalled();
	});

	it("records a resume on dismissal mid-flow", async () => {
		loadFile();
		importDraftStore.setStep("file");
		await presentSheet();
		await act(async () => {
			mockDismissHolder.current?.();
		});
		expect(importDraftStore.getResumeStep()).toBe("file");
		expect(importDraftStore.getSnapshot().ui.resumed).toBe(true);
	});

	it("clears instead of recording a resume when dismissed after a success", async () => {
		loadFile();
		importDraftStore.dispatch({
			fromModel: new Set(),
			links: new Map(),
			outcome: "applied",
			reason: null,
			type: "resolutionSettled",
		});
		importDraftStore.dispatch({ type: "commitStarted" });
		importDraftStore.dispatch({
			count: 1,
			duplicatesSkipped: 0,
			outAmount: 3.5,
			type: "commitSucceeded",
		});
		importDraftStore.setStep("done");
		const { findByText } = await presentSheet();
		expect(await findByText("step:done")).toBeTruthy();

		await act(async () => {
			mockDismissHolder.current?.();
		});
		expect(importDraftStore.getSnapshot().flow.parsed).toBeNull();
		expect(importDraftStore.getResumeStep()).toBe("source");
	});

	it("shows the resume notice on a resumed reopen and Start over clears", async () => {
		loadFile();
		importDraftStore.setStep("file");
		importDraftStore.commitDismissal();
		const { findByTestId, getByTestId } = await presentSheet();
		expect(await findByTestId("import-resume-notice")).toBeTruthy();

		fireEvent.press(getByTestId("import-resume-start-over"));
		expect(importDraftStore.getSnapshot().flow.parsed).toBeNull();
	});
});
