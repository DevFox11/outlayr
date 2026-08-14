import {
    ARCHIVE_FORMAT,
    ARCHIVE_VERSION,
    archiveFileName,
    archiveRowCount,
    decodeArchiveRow,
    encodeArchiveRow,
    parseArchive,
    serializeArchive,
} from "./archive";
import type { ArchiveDocument } from "./archive";

function emptyDocument(): ArchiveDocument {
    return {
        exportedAt: 1_700_000_000_000,
        format: ARCHIVE_FORMAT,
        tables: {
            accounts: [],
            appMeta: [],
            budgets: [],
            categories: [],
            mainBudget: [],
            transactions: [],
            transfers: [],
        },
        version: ARCHIVE_VERSION,
    };
}

describe("encoding a row", () => {
    it("writes an instant as epoch milliseconds", () => {
        const encoded = encodeArchiveRow("transactions", {
            date: new Date(1_700_000_000_000),
            id: "t1",
        });
        expect(encoded.date).toBe(1_700_000_000_000);
    });

    it("leaves a column that merely looks like a date alone", () => {
        // `note` is free text. Encoding by name rather than by value is what keeps
        // a note reading "2026-01-01" from being rewritten as a number.
        const encoded = encodeArchiveRow("transactions", { note: "2026-01-01" });
        expect(encoded.note).toBe("2026-01-01");
    });

    it("round-trips an instant back to the same moment", () => {
        const original = new Date(1_700_000_000_123);
        const decoded = decodeArchiveRow("transactions", encodeArchiveRow("transactions", { day: original }));
        expect(decoded.day instanceof Date).toBeTruthy();
        expect((decoded.day as Date).getTime()).toBe(original.getTime());
    });

    it("round-trips a null instant as null, not as the epoch", () => {
        const decoded = decodeArchiveRow("transactions", encodeArchiveRow("transactions", { deletedAt: null }));
        expect(decoded.deletedAt).toBeNull();
    });

    it("decodes an unusable instant to null rather than an invalid date", () => {
        // Restoring `new Date(NaN)` gives a row that throws the moment anything
        // formats it, which is worse than a row with no date.
        for (const bad of ["yesterday", Number.NaN, Number.POSITIVE_INFINITY]) {
            const decoded = decodeArchiveRow("transactions", { date: bad });
            expect(decoded.date).toBeNull();
        }
    });
});

describe("reading a file back", () => {
    it("round-trips a document through serialize and parse", () => {
        const document = emptyDocument();
        document.tables.categories = [{ id: "c1", name: "Food" }];
        const parsed = parseArchive(serializeArchive(document));
        expect(parsed).toStrictEqual(document);
    });

    it("refuses text that is not JSON at all", () => {
        expect(parseArchive("not json")).toBeNull();
    });

    it("refuses a JSON file that is not an archive", () => {
        expect(parseArchive(JSON.stringify({ hello: "world" }))).toBeNull();
        expect(parseArchive(JSON.stringify([1, 2, 3]))).toBeNull();
    });

    it("refuses a version this build cannot restore", () => {
        // The columns a later version adds are exactly the ones this build would
        // drop, and a restore replaces the whole ledger.
        const future = { ...emptyDocument(), version: ARCHIVE_VERSION + 1 };
        expect(parseArchive(JSON.stringify(future))).toBeNull();
    });

    it("refuses a table that is not a list of rows", () => {
        const broken = emptyDocument() as unknown as Record<string, unknown>;
        (broken.tables as Record<string, unknown>).transactions = "nope";
        expect(parseArchive(JSON.stringify(broken))).toBeNull();
    });

    it("refuses a table holding something that is not a row", () => {
        const broken = emptyDocument() as unknown as Record<string, unknown>;
        (broken.tables as Record<string, unknown>).transactions = [42];
        expect(parseArchive(JSON.stringify(broken))).toBeNull();
    });

    it("reads a table the file omits as empty rather than refusing it", () => {
        // An archive written before a table existed still holds intact data.
        const partial = emptyDocument() as unknown as Record<string, unknown>;
        (partial.tables as Record<string, unknown>).transfers = undefined;
        const parsed = parseArchive(JSON.stringify(partial));
        expect(parsed?.tables.transfers).toStrictEqual([]);
    });

    it("reads a file carrying a table this build has dropped", () => {
        // `templateTransactions` was archived until it was removed as dead. An
        // archive written before that still restores; the extra table is ignored
        // rather than read as a malformed file.
        const legacy = emptyDocument() as unknown as Record<string, unknown>;
        (legacy.tables as Record<string, unknown>).templateTransactions = [{ amount: 1, id: "p1" }];
        const parsed = parseArchive(JSON.stringify(legacy));
        expect(parsed).not.toBeNull();
        expect(Object.hasOwn(parsed?.tables ?? {}, "templateTransactions")).toBe(false);
    });
});

describe("describing a file", () => {
    it("counts every row a restore would write", () => {
        const document = emptyDocument();
        document.tables.categories = [{ id: "c1" }, { id: "c2" }];
        document.tables.transactions = [{ id: "t1" }];
        expect(archiveRowCount(document)).toBe(3);
    });

    it("names the file by the day it was written", () => {
        expect(archiveFileName(new Date(Date.UTC(2026, 6, 30, 15, 0)))).toBe("outlayr-archive-2026-07-30.json");
    });
});
