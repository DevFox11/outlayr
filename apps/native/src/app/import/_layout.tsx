import { Stack, useNavigation, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { useWindowDimensions } from "react-native";
import {
	ImportSheetChrome,
	type ImportSheetFooter,
} from "@/components/import-sheet/chrome";
import {
	CsvImportProvider,
	useCsvImportContext,
} from "@/contexts/csv-import-context";
import {
	ImportFlowProvider,
	useImportFlow,
} from "@/contexts/import-flow-context";
import { canAdvance, type ImportStep, stepFor } from "@/domain/import-flow";
import { type TranslationKey, useTranslation } from "@/i18n";
import { importStepDetents } from "@/lib/sheet-detents";

const STEP_TITLE: Record<ImportStep, TranslationKey> = {
	source: "import.titleSource",
	file: "import.titleFile",
	resolve: "import.titleResolve",
	review: "import.titleReview",
};

export default function ImportLayout() {
	return (
		<ImportFlowProvider>
			<CsvImportProvider>
				<ImportLayoutChrome />
			</CsvImportProvider>
		</ImportFlowProvider>
	);
}

function ImportLayoutChrome() {
	const t = useTranslation();
	const router = useRouter();
	const navigation = useNavigation();
	const pathname = usePathname();
	const { height } = useWindowDimensions();
	const { state } = useImportFlow();
	const csvImport = useCsvImportContext();
	const step = stepFor(pathname);

	useEffect(() => {
		navigation.setOptions({
			sheetAllowedDetents: importStepDetents(step, height),
		});
	}, [navigation, step, height]);

	const footer: ImportSheetFooter | null = (() => {
		if (step === "file") {
			return {
				label: t("common.continue"),
				onPress: () => router.push("/import/resolve"),
				disabled: !canAdvance(state, "file"),
			};
		}
		if (step === "resolve") {
			if (csvImport.outcome != null) {
				return {
					label: t("import.resolveReviewCtaPending"),
					onPress: () => undefined,
					disabled: true,
				};
			}
			return {
				label: t("import.resolveCategoriseCta", {
					count: csvImport.totalLabels,
				}),
				onPress: csvImport.run,
				disabled: csvImport.running,
			};
		}
		return null;
	})();

	return (
		<ImportSheetChrome
			canGoBack={step !== "source"}
			footer={footer}
			onBack={() => router.back()}
			onCancel={() => navigation.goBack()}
			title={t(STEP_TITLE[step])}
		>
			{/* A nested stack inside a formSheet gets no interactive back-swipe:
			    react-native-screens declines the pop gesture while the host screen
			    is presented as a sheet, so the chevron is the only way back. */}
			<Stack
				screenOptions={{ animation: "slide_from_right", headerShown: false }}
			/>
		</ImportSheetChrome>
	);
}
