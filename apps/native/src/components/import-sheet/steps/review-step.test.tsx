import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { ImportReviewResult } from "@/hooks/use-import-review";

import { EntryRow, ReviewStep } from "./review-step";

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 59 }),
}));
jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
    useColors: () => ({
        background: "#F2F0EA",
        danger: "#B5482F",
        foreground: "#17150F",
        income: "#2E7D32",
        muted: "#8A8578",
        subtle: "#B4AFA0",
    }),
}));
jest.mock("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => ({
        state: { showCents: true },
    }),
}));
jest.mock("@/hooks/use-review-enrichment", () => ({
    useReviewEnrichment: (entries: readonly { note: string }[]) =>
        new Map(entries.map((entry, index) => [index, { displayName: `clean:${entry.note}`, logoUri: null }])),
}));
jest.mock("@legendapp/list/section-list", () => {
    const { View: RNView } = require("react-native");
    interface MockSection {
        data: unknown[];
        key: string;
    }
    return {
        SectionList: ({
            sections,
            renderItem,
            renderSectionHeader,
            keyExtractor,
            ListFooterComponent,
        }: {
            sections: MockSection[];
            renderItem: (info: { item: unknown; index: number }) => ReactNode;
            renderSectionHeader: (info: { section: MockSection }) => ReactNode;
            keyExtractor: (item: unknown, index: number) => string;
            ListFooterComponent?: ReactNode;
        }) => (
            <RNView testID="legend-list">
                {sections.map((section) => (
                    <RNView key={section.key}>
                        {renderSectionHeader({ section })}
                        {section.data.map((item, index) => (
                            <RNView key={keyExtractor(item, index)}>{renderItem({ index, item })}</RNView>
                        ))}
                    </RNView>
                ))}
                {ListFooterComponent}
            </RNView>
        ),
    };
});

const ENTRY = {
    amount: 12.5,
    categoryId: "cat-food",
    currency: null,
    date: new Date(2026, 6, 28),
    income: false,
    note: "Bakery",
};

const OTHER_DAY_ENTRY = {
    ...ENTRY,
    amount: 2400,
    categoryId: "cat-pay",
    date: new Date(2026, 6, 27),
    income: true,
    note: "Salary",
};

const TILE = { color: "#3D8A4E", emoji: null, icon: "basket" };

function entryRowProps(overrides: Partial<Parameters<typeof EntryRow>[0]> = {}) {
    return {
        categoryName: "Groceries",
        checked: true,
        currency: "USD",
        displayName: "Bakery Corner",
        duplicate: false,
        entry: ENTRY,
        index: 0,
        logoUri: null,
        onToggle: jest.fn(),
        tile: TILE,
        ...overrides,
    };
}

interface JsonNode {
    children?: (JsonNode | string)[] | null;
    props?: Record<string, unknown>;
    type?: string;
}

function classNames(node: JsonNode | JsonNode[] | null): string[] {
    if (node == null) {
        return [];
    }
    if (Array.isArray(node)) {
        return node.flatMap(classNames);
    }
    const own = node.props?.className;
    return [
        ...(typeof own === "string" ? [own] : []),
        ...(node.children ?? []).flatMap((child) => (typeof child === "string" ? [] : classNames(child))),
    ];
}

describe("entryRow", () => {
    it("renders the enriched name, category subline, date and ledger-formatted amount", async () => {
        const { getByText } = await render(<EntryRow {...entryRowProps()} />);

        expect(getByText("Bakery Corner")).toBeTruthy();
        expect(getByText("Groceries")).toBeTruthy();
        expect(
            getByText(
                ENTRY.date.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                })
            )
        ).toBeTruthy();
        expect(getByText("-$12.50")).toBeTruthy();
    });

    it("marks income green-signed the way the ledger does", async () => {
        const { getByText } = await render(
            <EntryRow {...entryRowProps({ entry: { ...ENTRY, amount: 2400, income: true } })} />
        );
        expect(getByText("+$2,400.00")).toBeTruthy();
    });

    it("shows the duplicate warning subline instead of the category line", async () => {
        const { getByText, queryByText } = await render(
            <EntryRow {...entryRowProps({ checked: false, duplicate: true })} />
        );
        expect(getByText("import.reviewDuplicateCaption")).toBeTruthy();
        expect(queryByText("Groceries")).toBeNull();
    });

    it("toggles from a plain row tap, keeping the rowToggled event", async () => {
        const onToggle = jest.fn();
        const { getByTestId } = await render(<EntryRow {...entryRowProps({ index: 3, onToggle })} />);
        fireEvent.press(getByTestId("review-row-3"));
        expect(onToggle).toHaveBeenCalledWith(3);
    });

    it("dims and strikes the excluded state", async () => {
        const screen = await render(<EntryRow {...entryRowProps({ checked: false })} />);
        const names = classNames(screen.toJSON() as unknown as JsonNode);
        expect(names.some((name) => /\bopacity-40\b/.test(name))).toBe(true);
        expect(names.some((name) => /\bline-through\b/.test(name))).toBe(true);
    });

    it("keeps the included state unstruck", async () => {
        const screen = await render(<EntryRow {...entryRowProps()} />);
        const names = classNames(screen.toJSON() as unknown as JsonNode);
        expect(names.some((name) => /\bline-through\b/.test(name))).toBe(false);
    });
});

describe("reviewStep", () => {
    function baseReview(overrides: Partial<ImportReviewResult> = {}): ImportReviewResult {
        return {
            categoryName: new Map([["cat-food", "Groceries"]]),
            categoryTile: new Map([["cat-food", TILE]]),
            commit: { phase: "idle" },
            currency: "USD",
            excluded: new Set<number>(),
            onCommit: jest.fn(),
            onToggle: jest.fn(),
            plan: {
                earliest: null,
                entries: [ENTRY],
                latest: null,
                skipped: [],
            },
            rows: [
                {
                    duplicate: false,
                    entry: ENTRY,
                    index: 0,
                    key: "entry-0",
                    kind: "entry",
                },
            ],
            selectedCount: 1,
            ...overrides,
        } as ImportReviewResult;
    }

    it("pins the measure strip with the live selection count and out total", async () => {
        const { getAllByText, getByText } = await render(<ReviewStep review={baseReview()} />);
        expect(getByText("import.reviewToImportLabel")).toBeTruthy();
        expect(getByText('import.reviewToImportValue:{"count":1,"total":1}')).toBeTruthy();
        expect(getByText("log.measure.out")).toBeTruthy();
        expect(getAllByText("-$12.50").length).toBeGreaterThanOrEqual(2);
    });

    it("excludes toggled-off rows from the out total", async () => {
        const review = baseReview({ excluded: new Set([0]), selectedCount: 0 });
        const { getByText } = await render(<ReviewStep review={review} />);
        expect(getByText("-$0.00")).toBeTruthy();
    });

    it("orders day sections newest-first regardless of file order", async () => {
        const older = { ...ENTRY, date: new Date(2026, 6, 20), note: "Older" };
        const newer = { ...ENTRY, date: new Date(2026, 6, 29), note: "Newer" };
        const review = baseReview({
            plan: {
                earliest: null,
                entries: [older, newer],
                latest: null,
                skipped: [],
            },
            rows: [
                {
                    duplicate: false,
                    entry: older,
                    index: 0,
                    key: "entry-0",
                    kind: "entry",
                },
                {
                    duplicate: false,
                    entry: newer,
                    index: 1,
                    key: "entry-1",
                    kind: "entry",
                },
            ],
            selectedCount: 2,
        });
        const screen = await render(<ReviewStep review={review} />);
        const serialized = JSON.stringify(screen.toJSON());
        expect(serialized.indexOf("clean:Newer")).toBeLessThan(serialized.indexOf("clean:Older"));
    });

    it("groups entries under day headers with live included totals", async () => {
        const review = baseReview({
            plan: {
                earliest: null,
                entries: [ENTRY, OTHER_DAY_ENTRY],
                latest: null,
                skipped: [],
            },
            rows: [
                {
                    duplicate: false,
                    entry: ENTRY,
                    index: 0,
                    key: "entry-0",
                    kind: "entry",
                },
                {
                    duplicate: false,
                    entry: OTHER_DAY_ENTRY,
                    index: 1,
                    key: "entry-1",
                    kind: "entry",
                },
            ],
            selectedCount: 2,
        });
        const screen = await render(<ReviewStep review={review} />);
        const serialized = JSON.stringify(screen.toJSON());
        expect(serialized).toContain("-$12.50");
        expect(serialized).toContain("+$2,400.00");
        const dayRules = classNames(screen.toJSON() as unknown as JsonNode).filter((name) => name === "bg-border");
        expect(dayRules.length).toBeGreaterThanOrEqual(2);
    });

    it("collapses skipped rows behind the footnote toggle", async () => {
        const review = baseReview({
            plan: {
                earliest: null,
                entries: [ENTRY],
                latest: null,
                skipped: [{ reason: "amount", row: 3 }],
            },
            rows: [
                {
                    duplicate: false,
                    entry: ENTRY,
                    index: 0,
                    key: "entry-0",
                    kind: "entry",
                },
                { count: 1, key: "skipped-header", kind: "header" },
                { key: "skipped-3", kind: "skipped", reason: "amount", row: 3 },
            ],
        });
        const { findByText, getByTestId, getByText, queryByText } = await render(<ReviewStep review={review} />);

        expect(getByText('import.reviewSkippedShow:{"count":1}')).toBeTruthy();
        expect(queryByText("import.skipReasonAmount")).toBeNull();

        fireEvent.press(getByTestId("review-skipped-toggle"));
        expect(await findByText("import.skipReasonAmount")).toBeTruthy();
        expect(await findByText('import.reviewSkippedHide:{"count":1}')).toBeTruthy();
    });

    it("starts a duplicate unchecked, driven by the excluded set", async () => {
        const review = baseReview({
            excluded: new Set([0]),
            rows: [
                {
                    duplicate: true,
                    entry: ENTRY,
                    index: 0,
                    key: "entry-0",
                    kind: "entry",
                },
            ],
            selectedCount: 0,
        });
        const { getByTestId } = await render(<ReviewStep review={review} />);
        expect(getByTestId("review-row-0").props.accessibilityState.checked).toBe(false);
    });

    it("renders the empty state when there is nothing to import", async () => {
        const review = baseReview({ rows: [], selectedCount: 0 });
        const { getByText } = await render(<ReviewStep review={review} />);
        expect(getByText("import.reviewEmptyTitle")).toBeTruthy();
    });

    it("keeps the inline two-tap commit CTA", async () => {
        const onCommit = jest.fn();
        const review = baseReview({ onCommit });
        const { findByText, getByTestId } = await render(<ReviewStep review={review} />);

        fireEvent.press(getByTestId("review-commit-cta"));
        expect(onCommit).not.toHaveBeenCalled();
        expect(await findByText('import.reviewCommitConfirmCta:{"count":1}')).toBeTruthy();

        fireEvent.press(getByTestId("review-commit-cta"));
        expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("renders the commit-failed banner ruled, with Try again as the CTA label", async () => {
        const review = baseReview({
            commit: { detail: "disk full", phase: "failed" },
        });
        const { getByTestId, getByText } = await render(<ReviewStep review={review} />);
        expect(getByTestId("review-commit-failed")).toBeTruthy();
        expect(getByText("import.reviewCommitFailedTitle")).toBeTruthy();
        expect(getByText("disk full")).toBeTruthy();
        expect(getByText("import.tryAgain")).toBeTruthy();
    });

    it("draws no card washes anywhere", async () => {
        const screen = await render(<ReviewStep review={baseReview()} />);
        const washed = classNames(screen.toJSON() as unknown as JsonNode).filter(
            (name) => /\bbg-(background|surface|card|foreground\/\d+)\b/.test(name) || /\brounded-(xl|2xl)\b/.test(name)
        );
        expect(washed).toStrictEqual([]);
    });
});
