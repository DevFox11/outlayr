import { z } from "zod";

import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

const HTML_SPECIAL = /[&<>"']/g;

const escapeHtml = (text: string) => text.replace(HTML_SPECIAL, (char) => `&#${char.codePointAt(0)};`);

const PAGE_SCRIPT_HELPERS = `
const status = document.getElementById("status");
const post = (path, body) =>
    fetch(path, { body: JSON.stringify(body), credentials: "same-origin", headers: { "content-type": "application/json" }, method: "POST", redirect: "manual" });
`;

function page(body: string, script: string): Response {
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Outlayr</title>
<style>
body { font: 16px/1.5 system-ui, sans-serif; background: #f2efe8; color: #17150f; margin: 0; }
main { max-width: 22rem; margin: 20vh auto; padding: 0 1.5rem; }
h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
button { font: inherit; width: 100%; padding: .75rem; border: 0; border-radius: .75rem; background: #17150f; color: #f2efe8; cursor: pointer; margin-top: .5rem; }
button.quiet { background: transparent; color: inherit; box-shadow: inset 0 0 0 1px #17150f; }
</style>
</head>
<body>
<main>
${body}
<p id="status" role="status"></p>
</main>
<script>${PAGE_SCRIPT_HELPERS}${script}</script>
</body>
</html>`;
    return new Response(html, {
        headers: { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" },
    });
}

export function loginPage(): Response {
    return page(
        `<h1>Connect Outlayr</h1>
<p>Sign in with the account you use in the app.</p>
<button id="apple" type="button">Continue with Apple</button>
<button id="google" type="button">Continue with Google</button>`,
        `
const params = new URLSearchParams(location.search);
const ott = params.get("ott");
if (ott) {
    status.textContent = "Finishing sign-in…";
    params.delete("ott");
    const authorize = () => location.replace("/api/auth/mcp/authorize?" + params);
    post("/api/auth/cross-domain/one-time-token/verify", { token: ott }).then(authorize, authorize);
}
const signIn = (provider, name) => async () => {
    status.textContent = "Opening " + name + "…";
    const response = await post("/api/auth/sign-in/social", { callbackURL: location.href, provider });
    const { url } = await response.json();
    location.assign(url);
};
document.getElementById("apple").addEventListener("click", signIn("apple", "Apple"));
document.getElementById("google").addEventListener("click", signIn("google", "Google"));
`
    );
}

const pendingAuthorization = z
    .string()
    .transform((text, context) => {
        try {
            return JSON.parse(text);
        } catch {
            context.addIssue({ code: "custom", message: "Verification value is not JSON" });
            return z.NEVER;
        }
    })
    .pipe(z.object({ clientId: z.string(), redirectURI: z.string() }));

export async function consentPage(ctx: ActionCtx, request: Request): Promise<Response> {
    const consentCode = new URL(request.url).searchParams.get("consent_code") ?? "";
    const verification = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "verification",
        where: [{ field: "identifier", value: consentCode }],
    });
    const pending = pendingAuthorization.safeParse(verification?.value);
    const client =
        pending.success &&
        (await ctx.runQuery(components.betterAuth.adapter.findOne, {
            model: "oauthApplication",
            where: [{ field: "clientId", value: pending.data.clientId }],
        }));
    if (!pending.success || !client || verification.expiresAt < Date.now()) {
        return page("<h1>This request expired</h1><p>Start again from the app you were connecting.</p>", "");
    }
    const name = escapeHtml(client.name ?? "An app");
    const destination = escapeHtml(new URL(pending.data.redirectURI).host);
    return page(
        `<h1>Allow ${name} to read and add Outlayr entries?</h1>
<p>It will see your entries, categories, and amounts, and can log new entries. Access goes to <strong>${destination}</strong>.</p>
<button id="allow" type="button">Allow</button>
<button id="deny" class="quiet" type="button">Deny</button>`,
        `
const answer = async (accept) => {
    status.textContent = accept ? "Connecting…" : "Cancelling…";
    const consentCode = new URLSearchParams(location.search).get("consent_code");
    const response = await post("/api/auth/oauth2/consent", { accept, consent_code: consentCode });
    const { redirectURI } = await response.json();
    location.assign(redirectURI);
};
document.getElementById("allow").addEventListener("click", () => answer(true));
document.getElementById("deny").addEventListener("click", () => answer(false));
`
    );
}
