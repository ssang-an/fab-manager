# Demo fab data

This folder contains deterministic fictional data for the first Fab Manager prototype.

- `base_plan.csv`: One 100-step demonstration route. `oper_id` is the stable machine-readable operation key; `oper_desc` is the display label; `oper_seq` defines the route order.
- `lot_history.csv`: Chronological events for 100 lots. It powers timeline reconstruction and playback.
- `lot_current.csv`: A single as-of snapshot for the same 100 lots. It powers the live lot matrix.

Event colors for the UI should remain consistent: `wait` blue, `job start` orange, `proc` green, `hold` red, and `job end` gray. The timestamps and names are fictional and are not representative of any production fab.

Regenerate all three files with `node scripts/generate_sample_data.mjs`.
