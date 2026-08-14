import { applyMove } from "./reorder";

describe("applyMove", () => {
    it("moves an item forward past its own removal point", () => {
        expect(applyMove(["a", "b", "c", "d"], [0], 3)).toEqual(["b", "c", "a", "d"]);
    });

    it("moves an item to the end", () => {
        expect(applyMove(["a", "b", "c"], [0], 3)).toEqual(["b", "c", "a"]);
    });

    it("moves an item backward without offset correction", () => {
        expect(applyMove(["a", "b", "c", "d"], [3], 1)).toEqual(["a", "d", "b", "c"]);
    });

    it("keeps the array intact when source and destination coincide", () => {
        expect(applyMove(["a", "b", "c"], [1], 1)).toEqual(["a", "b", "c"]);
    });

    it("moves multiple items as one block", () => {
        expect(applyMove(["a", "b", "c", "d"], [0, 1], 4)).toEqual(["c", "d", "a", "b"]);
    });
});
