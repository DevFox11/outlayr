import { expect, test } from "@jest/globals";

import { SHEET_SCREENS } from "./root-stack";

// `sheet-detents.android.ts` is type-checked against the iOS file, so a detent it forgets is undefined only here, and the sheet crashes on open.
test("gives every form sheet a detent on Android", () => {
    for (const { detent, name } of SHEET_SCREENS) {
        expect({ detent: detent > 0 && detent <= 1, name }).toStrictEqual({ detent: true, name });
    }
});
