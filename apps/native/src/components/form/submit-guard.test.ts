import { describe, expect, it, jest } from "@jest/globals";
import { Alert } from "react-native";

import { holdSubmitting, pressSubmit, pressSubmitWith, reportSaveFailure } from "./submit-guard";

describe("pressSubmit", () => {
    it("calls handleSubmit when the form is not submitting", () => {
        const handleSubmit = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        pressSubmit({ handleSubmit, state: { isSubmitting: false } });
        expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it("does not call handleSubmit when the form is already submitting", () => {
        const handleSubmit = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
        pressSubmit({ handleSubmit, state: { isSubmitting: true } });
        expect(handleSubmit).not.toHaveBeenCalled();
    });

    it("catches a rejected handleSubmit instead of producing an unhandled rejection", async () => {
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        const handleSubmit = jest.fn<() => Promise<void>>().mockRejectedValue(new Error("boom"));

        pressSubmit({ handleSubmit, state: { isSubmitting: false } });
        await Promise.resolve();
        await Promise.resolve();

        expect(consoleError).toHaveBeenCalledWith("Form submit threw", expect.any(Error));
        consoleError.mockRestore();
    });
});

describe("pressSubmitWith", () => {
    it("passes meta through to handleSubmit", () => {
        const handleSubmit = jest.fn<(meta: "continue") => Promise<void>>().mockResolvedValue(undefined);
        pressSubmitWith({ handleSubmit, state: { isSubmitting: false } }, "continue");
        expect(handleSubmit).toHaveBeenCalledWith("continue");
    });

    it("does not call handleSubmit when the form is already submitting", () => {
        const handleSubmit = jest.fn<(meta: "finish") => Promise<void>>().mockResolvedValue(undefined);
        pressSubmitWith({ handleSubmit, state: { isSubmitting: true } }, "finish");
        expect(handleSubmit).not.toHaveBeenCalled();
    });
});

describe("holdSubmitting", () => {
    it("never settles", async () => {
        const settled = jest.fn();
        holdSubmitting().then(settled).catch(settled);
        await Promise.resolve();
        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();
    });
});

describe("reportSaveFailure", () => {
    it("shows the alert with the given title and body", () => {
        const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

        reportSaveFailure({ body: "Failed", title: "Oops" });

        expect(alertSpy).toHaveBeenCalledWith("Oops", "Failed");
        alertSpy.mockRestore();
    });

    it("logs the cause when a log message is provided", () => {
        const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        const cause = new Error("db write failed");

        reportSaveFailure({
            body: "Failed",
            cause,
            log: "save failed",
            title: "Oops",
        });

        expect(consoleError).toHaveBeenCalledWith("save failed", cause);
        alertSpy.mockRestore();
        consoleError.mockRestore();
    });

    it("does not log when no log message is provided", () => {
        const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

        reportSaveFailure({ body: "Failed", title: "Oops" });

        expect(consoleError).not.toHaveBeenCalled();
        alertSpy.mockRestore();
        consoleError.mockRestore();
    });
});
