import { fireEvent, render } from "@testing-library/react-native";
import type { UseCsvImportResult } from "@/hooks/use-csv-import";
import { ResolveStep } from "./resolve-step";

const mockPush = jest.fn();
const mockRun = jest.fn();

let mockContext: UseCsvImportResult;

function baseContext(
	overrides: Partial<UseCsvImportResult> = {},
): UseCsvImportResult {
	return {
		running: false,
		outcome: null,
		reason: null,
		links: new Map(),
		fromModel: new Set(),
		totalLabels: 24,
		tier1Matched: 0,
		tier2Sent: 0,
		run: mockRun,
		...overrides,
	};
}

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));
jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		muted: "#8A8578",
		subtle: "#B4AFA0",
		income: "#2E7D32",
		danger: "#B5482F",
		tint: "#3366FF",
	}),
}));
jest.mock("@/contexts/csv-import-context", () => ({
	useCsvImportContext: () => mockContext,
}));

describe("ResolveStep", () => {
	beforeEach(() => {
		mockPush.mockClear();
		mockRun.mockClear();
		mockContext = baseContext();
	});

	it("renders the consent card with exactly three bullets before the call", async () => {
		const { getAllByTestId, getByText, queryByText } = await render(
			<ResolveStep />,
		);

		expect(getByText("import.resolveConsentHeading")).toBeTruthy();
		expect(getByText("import.resolveConsentBulletLabels")).toBeTruthy();
		expect(getByText("import.resolveConsentBulletCategories")).toBeTruthy();
		expect(getByText("import.resolveConsentBulletNever")).toBeTruthy();
		expect(getAllByTestId("import-resolve-consent-bullet")).toHaveLength(3);
		expect(queryByText("import.resolveRunningReadFile")).toBeNull();
	});

	it("renders the running ledger rows while a resolution is in flight", async () => {
		mockContext = baseContext({
			running: true,
			tier1Matched: 18,
			totalLabels: 24,
			tier2Sent: 6,
		});
		const { getByText, queryByText } = await render(<ResolveStep />);

		expect(getByText("import.resolveRunningReadFile")).toBeTruthy();
		expect(getByText("import.resolveRunningMatched")).toBeTruthy();
		expect(getByText("18 of 24")).toBeTruthy();
		expect(getByText("import.resolveRunningAsked")).toBeTruthy();
		expect(getByText("6 of 6")).toBeTruthy();
		expect(queryByText("import.resolveConsentHeading")).toBeNull();
	});

	it("keeps the ledger rows visible, fully settled, on the applied outcome", async () => {
		mockContext = baseContext({
			outcome: "applied",
			tier1Matched: 18,
			totalLabels: 24,
			tier2Sent: 6,
		});
		const { getByText } = await render(<ResolveStep />);

		expect(getByText("import.resolveRunningReadFile")).toBeTruthy();
		expect(getByText("6 of 6")).toBeTruthy();
	});

	it.each([
		["offline", "import.unavailableOffline"],
		["timeout", "import.unavailableTimeout"],
		["rateLimited", "import.unavailableRateLimited"],
		["providerError", "import.unavailableProviderError"],
		["invalidResponse", "import.unavailableInvalidResponse"],
		["unauthenticated", "import.unavailableUnauthenticated"],
	] as const)(
		"renders the %s reason with Try again and no escape hatch",
		async (reason, copyKey) => {
			mockContext = baseContext({ outcome: "unavailable", reason });
			const { getByText, queryByText } = await render(<ResolveStep />);

			expect(getByText("import.unavailableTitle")).toBeTruthy();
			expect(getByText(copyKey)).toBeTruthy();
			expect(getByText("import.tryAgain")).toBeTruthy();
			expect(queryByText("import.mapManually")).toBeNull();
		},
	);

	it.each(["overCap", "notConfigured"] as const)(
		"omits Try again and the escape hatch for the %s reason, since retrying changes nothing",
		async (reason) => {
			mockContext = baseContext({ outcome: "unavailable", reason });
			const { queryByText } = await render(<ResolveStep />);

			expect(queryByText("import.tryAgain")).toBeNull();
			expect(queryByText("import.mapManually")).toBeNull();
		},
	);

	it("re-invokes run() when Try again is pressed", async () => {
		mockContext = baseContext({ outcome: "unavailable", reason: "offline" });
		const { getByText } = await render(<ResolveStep />);

		fireEvent.press(getByText("import.tryAgain"));
		expect(mockRun).toHaveBeenCalledTimes(1);
	});

	it("renders the declined banner with only Open Feature Lab, never Try again", async () => {
		mockContext = baseContext({ outcome: "declined" });
		const { getByText, queryByText } = await render(<ResolveStep />);

		expect(getByText("import.unavailableTitle")).toBeTruthy();
		expect(getByText("import.declinedBody")).toBeTruthy();
		expect(getByText("import.openFeatureLab")).toBeTruthy();
		expect(queryByText("import.tryAgain")).toBeNull();
		expect(queryByText("import.mapManually")).toBeNull();
	});

	it("pushes /settings/feature-lab from Open Feature Lab", async () => {
		mockContext = baseContext({ outcome: "declined" });
		const { getByText } = await render(<ResolveStep />);

		fireEvent.press(getByText("import.openFeatureLab"));
		expect(mockPush).toHaveBeenCalledWith("/settings/feature-lab");
	});
});
