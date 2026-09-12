# Engineering capabilities and remaining work

Every new engineering feature must ship with (1) a read-only analysis service or explicitly scoped action,
(2) validated tool schema, (3) sample questions, (4) regression tests including missing-data cases,
(5) observed/forecast provenance. Do not infer production authorization from a question.

## Implemented in this increment

Tool: fab.analyze_engineering, arguments: kind, optional lot_ids (maximum two), optional target.

| Kind | Question | Result |
|---|---|---|
| compare | LOT1231, LOT1203 진행 플랜이랑 레시피/진행장비 다른거 분석해줘 | Route membership, ordering, fab, recipe ID, observed assignment and forecast assignment differences |
| plan | LOT1231 진행 플랜 알려줘 | Full realized sample route and per-step recipe/tool assignment |
| eta | LOT1231 PLUG ETCH 언제 도착할까? | All exact matching occurrences, arrival and job start separately |
| eta | LOT1231 예상 팹아웃 일정은? | Recorded/forecast OUT or explicit not reached within horizon |
| dependencies | LOT1231 MAIN SAMPLE 관계 알려줘 | Parent/sample links; no invented approval or actual split genealogy |
| issues | 문제 LOT 분석해줘 | HOLD, WAIT >=6h, SEND >=3h sorted by state age |
| send | 장기 SEND 분석해줘 | Transfer duration exceptions, not quality holds |
| down | 장비 DOWN 영향 분석해줘 | Assigned exposure, state, estimated recovery; no unsupported causality |
| recipe_stats | 레시피별 처리시간 분석해줘 | Completed observed JOB mean and weighted sec/WF by recipe/tool/lot type |
| quality | 데이터 정합성 점검해줘 | Reverse timestamps, duplicate events, JOB START missing recipe |

Copilot presents an editable question catalogue, readable summaries, JSON download and explicit map-action buttons.
Question catalogue is regression-tested. LOT1231 normalizes to LOT-01231; unknown IDs error.
ETA uses exact operation ID or exact description. Duplicate descriptions are returned by occurrence, not silently collapsed.
No historical hindsight ETA: past queries return unavailable. Forecasts use the current scenario at the observed cutoff.
Explicit LOT queries ignore current UI lot filters; collection queries use current lot filters, not AREA highlight.
Comparison aligns description plus visit count; this does not prove semantic equivalence across different route versions.
Recipe comparison compares IDs, not physical recipe parameters, which are unavailable.

Personal tools: fab.personal_workspace (watch/unwatch/list/save_view), fab.restore_view.
Questions: “LOT1231 관심 등록”, “관심 LOT 목록”, “필터 저장 내 업무”, “필터 불러오기 내 업무”.
Local browser storage only; saves fab/program/route/search/time, not camera, AREA, exact-code mode or equipment filter.
No account sync or server persistence. Saving the same name replaces that local snapshot.

## Coverage ledger — NOT a completion claim

| Requested group | Existing / added | Remaining implementation |
|---|---|---|
| Issues and ranking | Process/equipment/hold WIP, AREA scopes, issue list by age | Capacity-normalized bottleneck score, change-rate panels, priority lot flags |
| Personal workspace | Local watched LOT IDs and basic filter snapshots | Watch dashboard, full camera snapshots, account sync, shared view links |
| R&D | MAIN/SAMPLE links, two-LOT plan comparison, target ETA | True split genealogy, experiment parameters, annotations, route revisions/rework |
| Holds | Code history, AHSO analysis, mean-release scenarios | Owner/action/deadline workflow, approval stages, actual measurement/spec links |
| Equipment/recipe | DOWN history, assigned impact, recipe IDs and grouped observed timing | Chamber model, recipe qualification, setup transitions, resource-valid backup recommendations |
| Transfers | SEND state, travel animation, long-SEND analysis | Dispatch/vehicle/receipt events, transfer-versus-wait optimization, return ETA workflows |
| Forecast | Existing 7-day closed-WIP model, hold scenarios, operation/OUT ETA | Future starts, recipe-specific forecast service, calibrated uncertainty, backtesting, saved scenario comparisons |
| Map | Selection, camera follow, route filters, layers | Level-of-detail aggregation, event-step navigation, side-by-side scene comparison |
| Copilot | Local intent router, analysis tools, example questions, result export/actions | LLM integration, multi-intent planning, user notification preferences, acknowledgment workflow |
| Production readiness | Synthetic markers, limited event checks, API boundaries | Real feed freshness, full reconciliation, SSO/RBAC, audit persistence, server-side authorization |

## Required production data contracts

- lot_master: lot_id, lot_code, wf_qty, program, priority, owner, target_time.
- route_version / route_step: route_id, version, step_occurrence_id, oper_id, sequence, branch edges, valid_from/to.
- job_event: event_id, source_time, received_time, lot_id, step_occurrence_id, job_id, event_code,
  equipment_id, chamber_id, recipe_id, recipe_revision, wf_qty.
- hold_episode / action: episode_id, code, reason, owner, due_at, acknowledgment, approval, release timestamps.
- measurement: sample_lot, job_id, metric, value, units, lower/upper spec, approved disposition.
- equipment_state / qualification: equipment/chamber, state interval, down code, note,
  qualified operation/recipe/revision, expiry, capacity, setup rules.
- transfer_event: transfer_id, from/to fab, dispatch, pickup, receipt, return plan.
- split_lineage / experiment: parent/child lot, wafers, condition, creation time, experiment ID.
- planned_release: planned LOT, route version, quantity, release time.
- identity/audit: SSO claims, per-tool permissions, immutable action record.

Absent facts must produce “data unavailable”, never synthetic approval, recipe qualification, confidence intervals,
chamber status or actual measurement conclusions. Synthetic approval assumptions must remain confined to simulation.
