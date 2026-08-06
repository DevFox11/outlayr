import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { TransferError } from "@/lib/data-transfer";
import { importDraftStore } from "@/lib/import-draft-store";
import { useChooseImportFile } from "./use-choose-import-file";

const mockPickCsvFile = jest.fn();

jest.mock("@/lib/data-transfer", () => {
	const actual = jest.requireActual("@/lib/data-transfer");
	return {
		...actual,
		pickCsvFile: (...args: unknown[]) => mockPickCsvFile(...args),
	};
});

function Harness() {
	const { status, choose } = useChooseImportFile();
	return (
		<Pressable accessibilityRole="button" onPress={choose}>
			<Text>{status === "loading" ? "picking" : "choose"}</Text>
		</Pressable>
	);
}

describe("useChooseImportFile", () => {
	beforeEach(() => {
		mockPickCsvFile.mockReset();
		importDraftStore.clear();
	});

	it("reports loading while the picker is open", async () => {
		let resolvePick!: (value: null) => void;
		mockPickCsvFile.mockReturnValue(
			new Promise((resolve) => {
				resolvePick = resolve;
			}),
		);
		const { getByText, findByText } = await render(<Harness />);

		fireEvent.press(getByText("choose"));
		await findByText("picking");

		resolvePick(null);
		await findByText("choose");
	});

	it("leaves the draft untouched when the user cancels the picker", async () => {
		mockPickCsvFile.mockResolvedValue(null);
		const { getByText } = await render(<Harness />);

		fireEvent.press(getByText("choose"));

		await waitFor(() => {
			expect(getByText("choose")).toBeTruthy();
		});
		expect(importDraftStore.getSnapshot().flow.parsed).toBeNull();
		expect(importDraftStore.getSnapshot().ui.fileError).toBeNull();
	});

	it("dispatches fileParsed with the resolved mapping, clearing any prior error first", async () => {
		importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		importDraftStore.setFileError({ cause: "empty" });
		mockPickCsvFile.mockResolvedValue({
			name: "bank.csv",
			text: "date,description,amount\n01/08/2026,Coffee,3,50\n",
		});
		const { getByText } = await render(<Harness />);

		fireEvent.press(getByText("choose"));

		await waitFor(() => {
			expect(importDraftStore.getSnapshot().flow.parsed).not.toBeNull();
		});
		expect(importDraftStore.getSnapshot().flow.mappingGaps).toStrictEqual([]);
		expect(importDraftStore.getSnapshot().flow.resolved?.labelSource).toBe(
			"descriptionColumn",
		);
		expect(importDraftStore.getSnapshot().ui.fileError).toBeNull();
	});

	it("records an io error with the thrown key", async () => {
		mockPickCsvFile.mockRejectedValue(
			new TransferError("alerts.transfer.unreadableFile"),
		);
		const { getByText } = await render(<Harness />);

		fireEvent.press(getByText("choose"));

		await waitFor(() => {
			expect(importDraftStore.getSnapshot().ui.fileError).toStrictEqual({
				cause: "io",
				key: "alerts.transfer.unreadableFile",
			});
		});
	});

	it.each([
		["", "empty"],
		["date,description,amount\n", "noDataRows"],
		["a,b\n1,2\n", "tooFewColumns"],
	])("classifies %j as %s", async (text, cause) => {
		mockPickCsvFile.mockResolvedValue({ name: "x.csv", text });
		const { getByText } = await render(<Harness />);

		fireEvent.press(getByText("choose"));

		await waitFor(() => {
			expect(importDraftStore.getSnapshot().ui.fileError).toStrictEqual({
				cause,
			});
		});
	});

	it("rejects a file over the hard parse cap before parsing", async () => {
		mockPickCsvFile.mockResolvedValue({
			name: "huge.csv",
			text: "a".repeat(20_000_001),
		});
		const { getByText } = await render(<Harness />);

		fireEvent.press(getByText("choose"));

		await waitFor(() => {
			expect(importDraftStore.getSnapshot().ui.fileError).toStrictEqual({
				cause: "tooLarge",
			});
		});
	});
});
