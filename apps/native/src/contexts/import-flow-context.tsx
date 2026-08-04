import { createContext, type Dispatch, use, useReducer } from "react";
import {
	type ImportFlowEvent,
	type ImportFlowState,
	INITIAL_IMPORT_FLOW_STATE,
	importFlowReducer,
} from "@/domain/import-flow";

interface ImportFlowContextValue {
	state: ImportFlowState;
	dispatch: Dispatch<ImportFlowEvent>;
}

const ImportFlowContext = createContext<ImportFlowContextValue | null>(null);

export function ImportFlowProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [state, dispatch] = useReducer(
		importFlowReducer,
		INITIAL_IMPORT_FLOW_STATE,
	);
	return (
		<ImportFlowContext.Provider value={{ state, dispatch }}>
			{children}
		</ImportFlowContext.Provider>
	);
}

export function useImportFlow(): ImportFlowContextValue {
	const value = use(ImportFlowContext);
	if (value == null) {
		throw new Error("useImportFlow must be used within ImportFlowProvider");
	}
	return value;
}
