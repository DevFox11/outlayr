import { reopenLocalData } from "./local-data-state";

describe("reopenLocalData", () => {
    it("atomically leaves ready before releasing the database", () => {
        const database = {} as never;

        expect(reopenLocalData({ attempt: 4, db: database, error: null, status: "ready" })).toStrictEqual({
            attempt: 5,
            db: null,
            error: null,
            status: "opening",
        });
    });
});
