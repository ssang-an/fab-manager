# Operation drilldown prototype

## Current node-map UI

The active renderer is now `src/operation-map.js` / `operation-map.css`, replacing the earlier card/list renderer. It uses a zoomable, pannable SVG with operation → tool → CH/LP curved branches and individually selectable lot circles; shared WAIT/HOLD queues are dot groups. Entry expands from the selected operation's screen position and Back/Escape contracts while restoring the captured main-map camera. Reduced-motion is respected. `operationMapLayout` is tested for lossless dense-lot placement. The original snapshot model and all telemetry limitations below still apply. No real chamber assignment is inferred.

Open by double-clicking an operation or using its detail panel's equipment/chamber expansion button. A zoom-in animation reveals an overlay tree: operation → eligible primary/backup tools → synthetic chambers and load ports → active lots. WAIT and HOLD remain separate shared queues below. Lot buttons return to map lot detail. The timeline and active lot filters update the view.

`operationSnapshot(data, states, nodeId, minute)` in `src/operation-drilldown.js` is the read-only query model reusable by future API/Copilot tools. It is not yet registered as an MCP tool. It partitions selected-operation resident lots without mutating simulation data. Transit and FAB OUT are excluded; unmatched active equipment assignments and JOB END remain visible separately.

LOAD is a display alias of JOB START (event 1), not measured loading telemetry. Three CH groups and two LP groups per tool are deterministic sample distributions of the selected operation's PROC / JOB START lots, not physical occupancy. Multiple lots in one group reflect demo parallel slots; IDLE/EMPTY means no matching selected-operation jobs, not verified equipment-wide idle. Production integration requires timestamped equipment/chamber/port state, carrier and lot bindings, actual LOAD events, physical capacity and qualification mappings. Never dispatch jobs or release holds from this view.
