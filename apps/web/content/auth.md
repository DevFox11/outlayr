# Outlayr auth.md

Outlayr is an expense tracker. Its MCP server lets an AI assistant read one person's Outlayr ledger after that person signs in and approves the assistant. Every token belongs to a person who approved it in a browser. There is no agent-only sign-up.

## Endpoints

- MCP server (Streamable HTTP): {origin}/mcp
- Protected resource metadata (RFC 9728): {origin}/.well-known/oauth-protected-resource/mcp
- Authorization server metadata (RFC 8414): {origin}/.well-known/oauth-authorization-server
- Issuer: {origin}

A request without a token gets `401` with `WWW-Authenticate: Bearer resource_metadata="..."`, so an MCP client can start from the server URL alone. Take endpoint URLs from the metadata rather than from this page.

## 1. Register a client

Dynamic Client Registration (RFC 7591) at the `registration_endpoint`, today `{origin}/api/auth/mcp/register`. It needs no credentials:

```http
POST /api/auth/mcp/register
Content-Type: application/json

{"client_name": "My assistant", "redirect_uris": ["http://127.0.0.1:8976/callback"], "token_endpoint_auth_method": "none"}
```

The `201` response carries your `client_id`. With `"none"` you are a public client and prove possession with PKCE. Any other method also returns a `client_secret`.

## 2. Sign the person in

Authorization code flow with PKCE, `S256` only:

1. Open the `authorization_endpoint` in the person's browser with `response_type=code`, `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256` and `scope=offline_access`.
2. They sign in with the Google or Apple account they use in the Outlayr app.
3. Outlayr shows a consent screen with your `client_name` and redirect host on every authorization. Nothing is issued until they approve.
4. Exchange the `code` at the `token_endpoint` with `grant_type=authorization_code`, `client_id`, `redirect_uri` and `code_verifier`.

Access tokens last 1 hour. With `offline_access` the token response also has a refresh token that lasts 7 days. Send it with `grant_type=refresh_token`.

## 3. Call the tools

Send `Authorization: Bearer <access_token>` with every request to `{origin}/mcp`. `tools/list` is the source of truth. Today it returns:

- `recent_transactions`: the person's latest entries, newest first, 20 by default and 50 at most.
- `spending_summary`: what they spent and earned in one budgeting month, in their main currency, by category.
- `account_balances`: each account's balance in its own currency and in their main currency.
- `budget_status`: the overall and category budgets for the current period, with what is spent and what is left.
- `upcoming_charges`: subscriptions and other recurring entries with their next charge, plus the monthly cost.
- `log_entry`: adds one expense or income. It needs Outlayr Pro, because only Pro syncs the entry to their devices.

The read tools see what the person's devices last synced. Syncing is part of Outlayr Pro, so someone who has never synced has no entries here.

## Not supported

- auth.md agent registration (`identity_endpoint`, ID-JAG, `service_auth`, anonymous). The `agent_auth` block in the authorization server metadata only points back to this page.
- Client credentials, API keys and token revocation. Tokens expire on their own.

## Without signing in

Product facts need no account: https://tryoutlayr.com/llms.txt, or the public MCP server at https://tryoutlayr.com/mcp.

Questions: support@tryoutlayr.com
