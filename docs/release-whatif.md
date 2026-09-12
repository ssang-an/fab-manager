# New release what-if

Toolbar: 투입 What-if. Input count 1–2000 MAIN lots, release period 1–7 days, route ID and 1–25 wafers/lot.
Read-only API: fab.what_if_release({count:"100", days:"3", route_id:"R01", wf_qty:"25"}).
Copilot example: 앞으로 3일 동안 R01 100개 랏 투입하면 어떻게 될까?
The authenticated LLM can invoke this validated analysis tool; it cannot change actual production plans.

Compares zero added release, uniform requested release, immediate requested release, and uniform half release.
All use full latest WIP, current forecast factor/hold-release assumptions and the SAME existing equipment slots/recovery.
Planned MAIN lots copy route-path and recipe variants cyclically from MAIN templates of the selected route.
Releases are scheduled into the same FCFS resource queue as existing lots, not added after a baseline calculation.

Results: future completed LOT/WF (excluding historical OUT), new/existing completion counts, existing-lot impact,
end WIP, integrated WAIT LOT·h, daily cumulative completions/WIP, top operation occurrences by cumulative wait.
Recommendation ranks candidate policies by completed LOT, then wait LOT·h, then smaller release volume.
This is NOT a global optimizer, dispatch recommendation, physical capacity estimate or confidence interval.
New holds, yield, setup, batching, costs, due-date objectives and newly planned equipment outages are not modeled.
Existing templates include synthetic processing at route gates; therefore compare scenarios, not absolute real throughput.

The result is independent of the map scenario: it does not add temporary LOTs to observed history or alter the current map.
Computation runs in a module worker (120-second timeout), one request at a time; the worker is terminated after completion.
