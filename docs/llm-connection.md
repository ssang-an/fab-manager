# Personal LLM connection

- Default base URL: http://common.llm.skhynix.com/v1.
- Key issuance link: https://llm-ops.skhynix.com (new tab, noopener/noreferrer).
- User must explicitly submit URL, personal API key and model ID.
- HTTP requires a separate plaintext-transport acknowledgement. Prefer an approved HTTPS endpoint in production.
- No request is sent by opening the panel. Authentication POSTs a tiny test prompt to /chat/completions.
- Only a compatible successful response sets connected; errors are sanitized, never raw server response bodies.
- Authorization uses Bearer, credentials omitted, redirects forbidden, per-request timeout 30 seconds.
- Endpoint compatibility, CORS and corporate reachability have NOT been verified against the real service.
- Model ID is free text; no invented model inventory. Header displays the configured authenticated model.
- Key is memory-only and removed from the password input after success. Reload/disconnect discards it.
- Settings edits invalidate authentication. Re-enter the key to authenticate changed settings.
- Authenticated chat uses only get_state/catalog/analyze_engineering tool schemas, with bounded tool iterations.
  Model cannot call production actions or arbitrary URLs. Local filter toolbox remains available separately.
- Requests are independent (no conversational-history transmission yet). Tool output can be truncated with explicit notice.

## Employee identity integration still required

No actual employee-number authentication exists in this prototype. Do not trust a typed employee ID as identity.
For production, use verified server-side SSO claims (subject/employee number) to scope an encrypted credential vault,
model permissions, connection settings and audit records. Do not persist keys in localStorage or return them in
tool schemas/state/logs. Sign-out or identity switch must abort in-flight calls and clear all client credentials/history.
Use an allowlisted server-side gateway if browser CORS or policy disallows direct access; do not implement an unrestricted URL proxy.

Current behavior: each fresh browser page has no key and presents settings on first Copilot open.
This does not implement persistent per-employee registration, automatic vault lookup, or production SSO.
