import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { useWindowDimensions } from "react-native";
import { useWizard, Wizard } from "@/components/wizard";
import {
	CsvImportProvider,
	useCsvImportContext,
} from "@/contexts/csv-import-context";
import {
	canAdvance,
	IMPORT_STEPS,
	type ImportStep,
} from "@/domain/import-flow";
import { type TranslationKey, useTranslation } from "@/i18n";
import { importDraftStore, useImportDraft } from "@/lib/import-draft-store";
import { ImportSheetChrome } from "./chrome";
import { ResumeNotice } from "./resume-notice";
import { FileStep } from "./steps/file-step";
import { ResolveStep } from "./steps/resolve-step";
import { SourceStep } from "./steps/source-step";
import { useImportSheetOptions } from "./use-sheet-options";

const STEP_TITLE: Record<ImportStep, TranslationKey> = {
	source: "import.titleSource",
	file: "import.titleFile",
	resolve: "import.titleResolve",
	review: "import.titleReview",
};

export function ImportSheet() {
	const router = useRouter();
	const draft = useImportDraft();

	useEffect(() => {
		return () => {
			importDraftStore.commitDismissal();
		};
	}, []);

	return (
		<CsvImportProvider>
			<Wizard<ImportStep>
				canLeave={(step) => canAdvance(draft.flow, step)}
				onExit={() => router.back()}
				onStepChange={(step) => importDraftStore.setStep(step)}
				step={draft.ui.step}
				steps={IMPORT_STEPS}
			>
				<ImportSheetShell />
			</Wizard>
		</CsvImportProvider>
	);
}

function ImportSheetShell() {
	const t = useTranslation();
	const { height } = useWindowDimensions();
	const { step, canGoBack, back, exit, next } = useWizard<ImportStep>();
	const draft = useImportDraft();
	const csvImport = useCsvImportContext();
	const sheetOptions = useImportSheetOptions(step, height);

	const footer = (() => {
		if (step === "file") {
			return (
				<Wizard.Actions>
					<Wizard.Actions.Item
						disabled={!canAdvance(draft.flow, "file")}
						label={t("common.continue")}
						onPress={next}
					/>
				</Wizard.Actions>
			);
		}
		if (step === "resolve") {
			const pending = csvImport.outcome != null;
			return (
				<Wizard.Actions>
					<Wizard.Actions.Item
						disabled={pending || csvImport.running}
						label={
							pending
								? t("import.resolveReviewCtaPending")
								: t("import.resolveCategoriseCta", {
										count: csvImport.totalLabels,
									})
						}
						onPress={csvImport.run}
					/>
				</Wizard.Actions>
			);
		}
		return undefined;
	})();

	return (
		<>
			<Stack.Screen options={sheetOptions} />
			<ImportSheetChrome
				canGoBack={canGoBack}
				footer={footer}
				onBack={back}
				onCancel={exit}
				title={t(STEP_TITLE[step])}
			>
				{draft.ui.resumed ? (
					<ResumeNotice onStartOver={() => importDraftStore.clear()} />
				) : null}
				<Wizard.Content>
					<Wizard.Step name="source">
						<SourceStep />
					</Wizard.Step>
					<Wizard.Step name="file">
						<FileStep />
					</Wizard.Step>
					<Wizard.Step name="resolve">
						<ResolveStep />
					</Wizard.Step>
				</Wizard.Content>
			</ImportSheetChrome>
		</>
	);
}
