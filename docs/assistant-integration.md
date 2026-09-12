# FAB Assistant integration

## Implemented now

- Enterprise-oriented system typography: Malgun Gothic on Windows, Apple SD Gothic Neo on macOS, Arial fallback. No claim of an official SK hynix design system or licensed company font.
- Header profile placeholder explicitly says SSO is disconnected. No fake identity or authentication.
- In-app assistant uses a deterministic, single-command Korean parser. It is NOT an LLM. No requests or company data are sent to external AI services.
- `window.fabManagerAPI.tools`: JSON Schema tool descriptions.
- `await window.fabManagerAPI.call(name, arguments)`: validated, allowlisted in-process API. UI updates and queries use the same application state.
- `await window.fabManagerAPI.rpc({jsonrpc:'2.0',id:1,method:'tools/list'})` and `tools/call` envelopes provide an MCP-style adapter boundary, NOT a deployed MCP server/transport or complete MCP protocol implementation.
- Last 100 successful calls are held in memory in `.audit`. No durable audit or chat storage.

## Tools

| Tool | Targets / values |
|---|---|
| `fab.get_state` | Selected time, current filters, WIP/state counts |
| `fab.catalog` | `query`: case-insensitive IDs; max 30 lot/code matches |
| `fab.set_filter` | `lot_code`, `lot_id` (exact ID; empty clears), `fab` (all/M10/M14/M15/M16/R3), `route` (route ID/all), `equipment` (ID/empty), `rank` (process/equipment/hold), `area` (ALL/PHOTO/ETCH/DIFF/T/F/CMP/CLEAN/MI), `focus` (all/hold/wait/move), `hold_code` (code/ALL), `program` (R&D/ALL) |
| `fab.set_view` | `dimension` (2d/3d), `orientation` (vertical/horizontal), `labels`/`heat` (true/false), `theme` (light/dark), `time` (0–20160 minutes), `speed` (2/5/30/120/720) |
| `fab.set_scenario` | `hold_hours` (0–168/none), `process_factor` (0.8/1/1.25) |
| `fab.compare_lots` | `lot_ids`: up to six exact IDs, empty clears |
| `fab.reset_filters` | Clears lot, fab, route, equipment, highlight and ranking/history-code filters; keeps time/scenario |

Target/value tool values are strings. Area and focus are emphasis, not WIP filters. Equipment search highlights its active operations; hold-code filters historical analysis only. Global filters intersect; setting a lot code does not silently clear a user's FAB/route filters. Missing IDs fail without substituting a sample identity. Browser API only controls this page; it cannot release holds, operate tools, modify routes or authenticate users.

## Future production boundary (not implemented)

Use a same-origin authenticated backend for SSO sessions and a server-validated profile endpoint (display name/avatar). Do not pass identity via unsigned browser inputs. Store SSO/LLM credentials on the backend, never in frontend JavaScript. Integrate the approved internal LLM with the exported tool schemas and return structured tool calls through the allowlist. A real MCP transport needs protocol/session handling, auth, per-user/page routing, authorization and durable auditing. Browser state is not a shared global server session. Add explicit consent and role-based checks before exposing anything beyond view/filter actions. Company inform notes must remain within the approved environment.
