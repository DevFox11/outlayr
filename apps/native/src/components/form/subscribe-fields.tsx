import { useSelector } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { shallowEqual } from "./shallow-equal";

interface Subscribable<TState> {
	get: () => TState;
	subscribe: (listener: (value: TState) => void) => { unsubscribe: () => void };
}

interface SubscribeFieldsProps<TState, TSelected> {
	store: Subscribable<TState>;
	selector: (state: TState) => TSelected;
	children: (selected: TSelected) => ReactNode;
}

/**
 * `form.Subscribe` compares with `===`, so a selector returning an object or
 * tuple re-renders on every store write — the shape TanStack's own docs show.
 * This is that component with a shallow comparator, for subtrees that need more
 * than one field. Prefer plain `form.Subscribe` when a single primitive will do.
 */
export function SubscribeFields<TState, TSelected>({
	store,
	selector,
	children,
}: SubscribeFieldsProps<TState, TSelected>) {
	const selected = useSelector(store, selector, { compare: shallowEqual });
	return <>{children(selected)}</>;
}
