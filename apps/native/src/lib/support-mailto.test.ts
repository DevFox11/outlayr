import { describe, expect, it } from "@jest/globals";

import { supportBody, supportMailto } from "./support-mailto";

const INFO = {
    appBuild: "42",
    appName: "Outlayr",
    appVersion: "1.2.0",
    deviceName: "iPhone",
    osName: "iOS",
    osVersion: "26.0",
};

describe("support email body", () => {
    it("carries every diagnostic Swift prefilled", () => {
        const body = supportBody(INFO);
        expect(body).toMatch(/Application Name: Outlayr/);
        expect(body).toMatch(/Platform: iOS 26\.0/);
        expect(body).toMatch(/Device: iPhone/);
        expect(body).toMatch(/App Version: 1\.2\.0/);
        expect(body).toMatch(/App Build: 42/);
    });

    it("ends with a rule the user writes below", () => {
        const lines = supportBody(INFO).split("\n");
        expect(lines.at(-1)).toBe("--------------------------------------");
    });

    it("keeps an unknown field readable rather than printing undefined", () => {
        const body = supportBody({ ...INFO, deviceName: "" });
        expect(body).toMatch(/Device: Unknown/);
        expect(body).not.toMatch(/undefined/);
    });
});

describe("support mailto", () => {
    it("addresses the mail and encodes the subject", () => {
        const url = supportMailto("help@example.com", "Feature Request", INFO);
        expect(url).toMatch(/^mailto:help@example\.com\?/);
        expect(url).toMatch(/subject=Feature%20Request/);
    });

    it("percent-encodes the body so newlines never truncate the link", () => {
        const url = supportMailto("help@example.com", "Support Email", INFO);
        const [, body] = url.split("&body=");
        expect(body).toBeTruthy();
        expect(body).not.toMatch(/\n/);
        expect(decodeURIComponent(body)).toBe(supportBody(INFO));
    });

    it("escapes an ampersand in the body instead of starting a new parameter", () => {
        const url = supportMailto("help@example.com", "Support Email", {
            ...INFO,
            appName: "Out&layr",
        });
        expect(url.split("&body=")).toHaveLength(2);
        expect(url).toMatch(/Out%26layr/);
    });

    it("escapes an ampersand in the subject", () => {
        const url = supportMailto("help@example.com", "Bugs & Ideas", INFO);
        expect(url).toMatch(/subject=Bugs%20%26%20Ideas/);
        expect(url.split("&body=")).toHaveLength(2);
    });
});
