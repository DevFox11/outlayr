import { useState } from "react";
import {
	guessMapping,
	type ParsedImportFile,
	parseImportFile,
} from "@/data/transfer-core";
import {
	classifyParseFailure,
	HARD_PARSE_REJECT_CHARS,
} from "@/domain/import-diagnosis";
import { resolveImportMapping } from "@/domain/import-mapping";
import { pickCsvFile, TransferError } from "@/lib/data-transfer";
import { importDraftStore } from "@/lib/import-draft-store";

export function useChooseImportFile() {
	const [status, setStatus] = useState<"idle" | "loading">("idle");

	const choose = async () => {
		setStatus("loading");
		importDraftStore.setFileError(null);
		try {
			const picked = await pickCsvFile();
			if (picked == null) {
				setStatus("idle");
				return;
			}
			if (picked.text.length > HARD_PARSE_REJECT_CHARS) {
				setStatus("idle");
				importDraftStore.setFileError({ cause: "tooLarge" });
				return;
			}
			const parsed: ParsedImportFile | null = parseImportFile(picked.text);
			if (parsed == null) {
				setStatus("idle");
				importDraftStore.setFileError({
					cause: classifyParseFailure(picked.text),
				});
				return;
			}
			const draft =
				parsed.header == null
					? {
							category: null,
							note: null,
							date: null,
							amount: null,
							currency: null,
							type: null,
						}
					: guessMapping(parsed.header);
			const resolution = resolveImportMapping(draft);
			importDraftStore.dispatch({
				type: "fileParsed",
				file: { name: picked.name, chars: picked.text.length },
				parsed,
				draft,
				resolved: resolution.ok ? resolution.value : null,
				gaps: resolution.ok ? [] : resolution.gaps,
			});
			setStatus("idle");
		} catch (thrown) {
			setStatus("idle");
			importDraftStore.setFileError(
				thrown instanceof TransferError
					? { cause: "io", key: thrown.key }
					: { cause: "io", key: "alerts.transfer.unreadableFile" },
			);
		}
	};

	return { status, choose };
}
