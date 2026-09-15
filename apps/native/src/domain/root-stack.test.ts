import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";
import { StackRouter } from "expo-router/react-navigation";
import {
    createSourceFile,
    forEachChild,
    isBinaryExpression,
    isCallExpression,
    isIdentifier,
    isJsxAttribute,
    isJsxElement,
    isJsxExpression,
    isJsxSelfClosingElement,
    isPropertyAccessExpression,
    isStringLiteral,
    ScriptKind,
    ScriptTarget,
    SyntaxKind,
} from "typescript";
import type {
    JsxAttribute,
    JsxElement,
    JsxOpeningLikeElement,
    JsxSelfClosingElement,
    Node,
    SourceFile,
} from "typescript";

import type { RootStackGroup } from "@/domain/auth-gate";

import { MODAL_SCREENS, ROOT_STACK_SCREEN_NAMES, SHEET_SCREENS, TITLED_SCREENS } from "./root-stack";

const GROUPS: readonly RootStackGroup[] = ["onboarding", "sign-in", "adopt", "ledger"];

const APP_DIR = join(import.meta.dirname, "..", "app");
const LAYOUT_PATH = join(APP_DIR, "_layout.tsx");

// expo-router's route context (`expo-router/_ctx.ios.js`) registers *every*
// `.[tj]sx?` file under `app/`, excluding only `+api`, `+html`, `+middleware`
// and `+native-intent`. Nothing filters test files: a `*.test.tsx` left here
// becomes a real, undeclared route — admitted into every guard group, outside
// the partition below — and ships in the production bundle. Tests for a route
// belong beside their screen under `src/screens/`.
const ROUTE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const LAYOUT_BASENAME = "_layout";
const IGNORED_ROUTE_BASENAMES = new Set(["+api", "+html", "+middleware", "+native-intent"]);

const UNGUARDED_CATCH_ALL = "+not-found";

function byCodeUnit(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

function routeBasename(fileName: string): string | null {
    const extension = ROUTE_EXTENSIONS.find((candidate) => fileName.endsWith(candidate));
    if (extension === undefined) {
        return null;
    }
    const base = fileName.slice(0, -extension.length);
    if (base === LAYOUT_BASENAME || IGNORED_ROUTE_BASENAMES.has(base)) {
        return null;
    }
    return base;
}

function hasOwnLayout(dir: string): boolean {
    return ROUTE_EXTENSIONS.some((extension) => existsSync(join(dir, `${LAYOUT_BASENAME}${extension}`)));
}

function collectRouteNames(dir: string, prefix: string): string[] {
    const names: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            const nested = prefix ? `${prefix}/${entry.name}` : entry.name;
            const nestedDir = join(dir, entry.name);
            names.push(...(hasOwnLayout(nestedDir) ? [nested] : collectRouteNames(nestedDir, nested)));
            continue;
        }
        const base = routeBasename(entry.name);
        if (base === null) {
            continue;
        }
        names.push(prefix ? `${prefix}/${base}` : base);
    }
    return names;
}

/**
 * Every route leaf under app/, layouts included, without collapsing a
 * directory to its owner: `collectRouteNames` folds `(tabs)/…` into `(tabs)`
 * for the partition, but expo-router still registers each nested file.
 */
function collectLeafRoutes(dir: string, prefix: string): string[] {
    const names: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const nested = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            names.push(...collectLeafRoutes(join(dir, entry.name), nested));
            continue;
        }
        const base = routeBasename(entry.name);
        if (base !== null) {
            names.push(prefix ? `${prefix}/${base}` : base);
        }
    }
    return names;
}

const ROUTE_FILES_ON_DISK = collectRouteNames(APP_DIR, "");
const ROUTE_LEAVES_ON_DISK = collectLeafRoutes(APP_DIR, "");
const PARTITIONABLE_ROUTES = ROUTE_FILES_ON_DISK.filter((name) => name !== UNGUARDED_CATCH_ALL);

describe("routes derived from the app directory", () => {
    it("collapses a directory owning a _layout into a single route name", () => {
        expect(ROUTE_FILES_ON_DISK).toContain("(tabs)");
        expect(ROUTE_FILES_ON_DISK.filter((name) => name.startsWith("(tabs)/"))).toStrictEqual([]);
    });

    it("finds +not-found on disk and holds it out of the partition", () => {
        expect(ROUTE_FILES_ON_DISK).toContain(UNGUARDED_CATCH_ALL);
        expect(PARTITIONABLE_ROUTES).not.toContain(UNGUARDED_CATCH_ALL);
    });

    // The import flow is one BottomSheetModal presented over the Log, never a
    // route: a stray app/import screen would re-grow the nested-navigator sheet
    // it replaced. Checked on disk here and in the rendered layout below.
    it("registers no import route on disk, at any depth", () => {
        expect(ROUTE_LEAVES_ON_DISK.length).toBeGreaterThan(ROUTE_FILES_ON_DISK.length);
        expect(ROUTE_LEAVES_ON_DISK.filter((name) => /(^|\/)import(\/|$)/.test(name))).toStrictEqual([]);
    });
});

describe("root stack total-partition invariant", () => {
    const groups = GROUPS.map((group) => ROOT_STACK_SCREEN_NAMES[group]);

    it("covers every route file under app/ exactly once", () => {
        const union = groups.flat();
        const declared = new Set(union);
        const unpartitioned = PARTITIONABLE_ROUTES.filter((name) => !declared.has(name));
        const phantom = union.filter((name) => !PARTITIONABLE_ROUTES.includes(name));
        expect({ phantom, unpartitioned }).toStrictEqual({
            phantom: [],
            unpartitioned: [],
        });
        expect(union).toHaveLength(PARTITIONABLE_ROUTES.length);
    });

    it("keeps every pair of groups pairwise disjoint", () => {
        for (let i = 0; i < groups.length; i += 1) {
            for (let j = i + 1; j < groups.length; j += 1) {
                const overlap = groups[i].filter((name) => groups[j].includes(name));
                expect(overlap).toStrictEqual([]);
            }
        }
    });

    it("never admits +not-found into any group", () => {
        for (const group of groups) {
            expect(group).not.toContain(UNGUARDED_CATCH_ALL);
        }
    });

    it("declares settings/categories/reorder under the ledger group", () => {
        expect(ROOT_STACK_SCREEN_NAMES.ledger).toContain("settings/categories/reorder");
    });
});

interface RenderedScreen {
    group: RootStackGroup | null;
    line: number;
    name: string;
}

type NamedList = readonly { name: string }[];

const DYNAMIC_SCREEN_LISTS: Record<string, NamedList> = {
    MODAL_SCREENS,
    SHEET_SCREENS,
    TITLED_SCREENS,
};

type JsxTag = JsxElement | JsxSelfClosingElement;

function openingOf(node: JsxTag): JsxOpeningLikeElement {
    return isJsxElement(node) ? node.openingElement : node;
}

function jsxTagName(node: JsxTag): string {
    return openingOf(node).tagName.getText();
}

function jsxAttribute(node: JsxTag, attribute: string): JsxAttribute | null {
    const found = openingOf(node).attributes.properties.find(
        (property): property is JsxAttribute => isJsxAttribute(property) && property.name.getText() === attribute
    );
    return found ?? null;
}

function lineOf(node: Node, source: SourceFile): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function guardedGroup(node: JsxTag, source: SourceFile): RootStackGroup {
    const initializer = jsxAttribute(node, "guard")?.initializer;
    const expression = initializer && isJsxExpression(initializer) ? initializer.expression : undefined;
    if (
        expression === undefined ||
        !isBinaryExpression(expression) ||
        expression.operatorToken.kind !== SyntaxKind.EqualsEqualsEqualsToken ||
        !isIdentifier(expression.left) ||
        expression.left.text !== "group" ||
        !isStringLiteral(expression.right)
    ) {
        throw new Error(
            `app/_layout.tsx:${lineOf(node, source)} <Stack.Protected> does not carry a \`guard={group === "<name>"}\` prop. This test only understands that shape — restore it, or teach the test the new one before landing the change.`
        );
    }
    const group = expression.right.text;
    if (!GROUPS.includes(group as RootStackGroup)) {
        throw new Error(
            `app/_layout.tsx:${lineOf(node, source)} <Stack.Protected> guards on "${group}", which is not a root stack group (${GROUPS.join(", ")}). Add it to ROOT_STACK_SCREEN_NAMES and to GROUPS here.`
        );
    }
    return group as RootStackGroup;
}

function mappedList(node: Node): NamedList | null {
    if (
        !(isCallExpression(node) && isPropertyAccessExpression(node.expression)) ||
        node.expression.name.text !== "map" ||
        !isIdentifier(node.expression.expression)
    ) {
        return null;
    }
    return DYNAMIC_SCREEN_LISTS[node.expression.expression.text] ?? null;
}

function renderedNames(
    node: JsxTag,
    source: SourceFile,
    group: RootStackGroup | null,
    list: NamedList | null
): RenderedScreen[] {
    const line = lineOf(node, source);
    const initializer = jsxAttribute(node, "name")?.initializer;
    if (initializer && isStringLiteral(initializer)) {
        return [{ group, line, name: initializer.text }];
    }
    if (
        initializer &&
        isJsxExpression(initializer) &&
        initializer.expression &&
        isPropertyAccessExpression(initializer.expression)
    ) {
        if (list === null) {
            throw new Error(
                `app/_layout.tsx:${line} <Stack.Screen name={…}> is computed outside any known screen list (${Object.keys(DYNAMIC_SCREEN_LISTS).join(", ")}). Move the names into one of those exported lists, or teach this test how to expand the new one.`
            );
        }
        return list.map((entry) => ({ group, line, name: entry.name }));
    }
    throw new Error(
        `app/_layout.tsx:${line} <Stack.Screen> has no \`name\` this test can read. Give it a string literal, or render it from one of the exported screen lists (${Object.keys(DYNAMIC_SCREEN_LISTS).join(", ")}).`
    );
}

function parseLayoutScreens(layoutSource: string): RenderedScreen[] {
    const source = createSourceFile("_layout.tsx", layoutSource, ScriptTarget.Latest, true, ScriptKind.TSX);
    const screens: RenderedScreen[] = [];

    const visit = (node: Node, group: RootStackGroup | null, list: NamedList | null) => {
        const mapped = mappedList(node);
        if (mapped !== null && isCallExpression(node)) {
            for (const argument of node.arguments) {
                visit(argument, group, mapped);
            }
            return;
        }
        if (isJsxElement(node) || isJsxSelfClosingElement(node)) {
            const tag = jsxTagName(node);
            if (tag === "Stack.Protected") {
                const nested = guardedGroup(node, source);
                forEachChild(node, (child) => visit(child, nested, list));
                return;
            }
            if (tag === "Stack.Screen") {
                screens.push(...renderedNames(node, source, group, list));
            }
        }
        forEachChild(node, (child) => visit(child, group, list));
    };

    visit(source, null, null);
    return screens;
}

describe("guard partition written in app/_layout.tsx", () => {
    const rendered = parseLayoutScreens(readFileSync(LAYOUT_PATH, "utf-8"));

    it("reads back the screens the layout actually renders", () => {
        expect(rendered.map((screen) => screen.name)).toContain("(tabs)");
        expect(rendered).toHaveLength(GROUPS.flatMap((group) => ROOT_STACK_SCREEN_NAMES[group]).length);
    });

    it("renders no import screen", () => {
        expect(rendered.map((screen) => screen.name)).not.toContain("import");
    });

    it("renders no Stack.Screen outside every Stack.Protected block", () => {
        const stranded = rendered
            .filter((screen) => screen.group === null)
            .map(
                (screen) =>
                    `app/_layout.tsx:${screen.line} "${screen.name}" sits outside every <Stack.Protected> block. A guard flip filters the stack against the new routeNames and only re-seats when nothing survives, so this screen survives every flip and strands the stack on it — no tab bar, no way back. Move it inside the block for its group and list it in ROOT_STACK_SCREEN_NAMES.`
            );
        expect(stranded).toStrictEqual([]);
    });

    it("renders exactly the name-to-group partition declared in root-stack.ts", () => {
        const declaredGroupOf = new Map(
            GROUPS.flatMap((group) =>
                ROOT_STACK_SCREEN_NAMES[group].map((name) => [name, group] as [string, RootStackGroup])
            )
        );
        const drift = rendered
            .filter((screen) => screen.group !== null && declaredGroupOf.get(screen.name) !== screen.group)
            .map(
                (screen) =>
                    `app/_layout.tsx:${screen.line} "${screen.name}" is rendered under the "${screen.group}" guard but ROOT_STACK_SCREEN_NAMES puts it under "${declaredGroupOf.get(screen.name) ?? "no group"}". Make the two agree — the invariant test above trusts the constant, the router obeys the JSX.`
            );
        expect(drift).toStrictEqual([]);

        const renderedByGroup = Object.fromEntries(
            GROUPS.map((group) => [
                group,
                rendered
                    .filter((screen) => screen.group === group)
                    .map((screen) => screen.name)
                    .sort(byCodeUnit),
            ])
        );
        const declaredByGroup = Object.fromEntries(
            GROUPS.map((group) => [group, [...ROOT_STACK_SCREEN_NAMES[group]].sort(byCodeUnit)])
        );
        expect(renderedByGroup).toStrictEqual(declaredByGroup);
    });
});

describe("the layout parser only accepts a strict-equality guard", () => {
    const layout = (guard: string) => `
		const tree = (
			<Stack>
				<Stack.Protected guard={${guard}}>
					<Stack.Screen name="(tabs)" />
				</Stack.Protected>
			</Stack>
		);
	`;

    it("reads the canonical shape", () => {
        expect(parseLayoutScreens(layout('group === "ledger"'))).toStrictEqual([
            { group: "ledger", line: 5, name: "(tabs)" },
        ]);
    });

    it("rejects an inverted guard", () => {
        expect(() => parseLayoutScreens(layout('group !== "ledger"'))).toThrow(
            /does not carry a `guard=\{group === "<name>"\}` prop/
        );
    });

    it("rejects a guard on some other subject", () => {
        expect(() => parseLayoutScreens(layout('route === "ledger"'))).toThrow(
            /does not carry a `guard=\{group === "<name>"\}` prop/
        );
    });
});

interface TestRoute {
    key: string;
    name: string;
}

interface TestStackState {
    index: number;
    key: string;
    preloadedRoutes: TestRoute[];
    routeNames: string[];
    routes: TestRoute[];
    stale: false;
    type: "stack";
}

function entryScreen(group: RootStackGroup): string {
    return ROOT_STACK_SCREEN_NAMES[group][0];
}

function beforeStackFor(group: RootStackGroup): TestRoute[] {
    const names = ROOT_STACK_SCREEN_NAMES[group];
    const [entry] = names;
    const pushed = names.includes("settings/account") ? "settings/account" : names.at(-1);
    if (pushed === undefined || pushed === entry) {
        return [{ key: `${entry}-a`, name: entry }];
    }
    return [
        { key: `${entry}-a`, name: entry },
        { key: `${pushed}-a`, name: pushed },
    ];
}

const PAIRS: [RootStackGroup, RootStackGroup][] = GROUPS.flatMap((before) =>
    GROUPS.filter((after) => after !== before).map((after): [RootStackGroup, RootStackGroup] => [before, after])
);

const REQUIRED_PAIRS: [RootStackGroup, RootStackGroup][] = [
    ["ledger", "sign-in"],
    ["ledger", "adopt"],
    ["adopt", "ledger"],
    ["sign-in", "ledger"],
];

describe("stack re-seating on every mode transition", () => {
    it.each(PAIRS)("%s -> %s empties and re-seats on the entry screen", (before, after) => {
        const router = StackRouter({});
        const beforeRoutes = beforeStackFor(before);
        const state: TestStackState = {
            index: beforeRoutes.length - 1,
            key: "stack-test",
            preloadedRoutes: [],
            routeNames: [...ROOT_STACK_SCREEN_NAMES[before]],
            routes: beforeRoutes,
            stale: false,
            type: "stack",
        };

        const result = router.getStateForRouteNamesChange(state, {
            routeGetIdList: {},
            routeKeyChanges: [],
            routeNames: [...ROOT_STACK_SCREEN_NAMES[after]],
            routeParamList: {},
        });

        expect(result.routes).toHaveLength(1);
        expect(result.routes[0].name).toBe(entryScreen(after));
        expect(result.index).toBe(0);
    });

    it("covers the four spec-required transitions", () => {
        for (const pair of REQUIRED_PAIRS) {
            expect(PAIRS).toContainEqual(pair);
        }
    });
});
