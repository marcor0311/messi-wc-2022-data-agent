# Discovered Gold catalog

Load: `4f7a541c93d7271e6980966a0e5ba8614714567c1fea0b5391e7e6fede5e2ac9`

- **actions**: 234,531 rows; 70 columns.
- **connections**: 15,206 rows; 10 columns.
- **initial_lineups**: 128 rows; 6 columns.
- **lineup_changes**: 981 rows; 11 columns.
- **lineup_segments**: 1,109 rows; 15 columns.
- **player_match**: 3,244 rows; 54 columns.
- **receipts**: 56,346 rows; 8 columns.
- **segment_player_metrics**: 12,119 rows; 49 columns.
- **shootout_actions**: 106 rows; 8 columns.
- **shot_creations**: 1,039 rows; 7 columns.
- **team_match**: 128 rows; 58 columns.

Complete columns, types, null counts, ranges, categorical values, hashes and metric definitions: [GOLD_CATALOG.json](GOLD_CATALOG.json).

- match_id joins match datasets; team_id joins team_match.
- player_id / recipient_id / creator_id / shooter_id join player_match by player_id and match_id.
- lineup_segment_id / segment_id join lineup_segments.
- event_id / shot_event_id / pass_event_id join actions by event_id and match_id.
- No continuous tracking, speed, distance covered or physical workload.
- Declared tactical positions are not measured player coordinates.
- Shootouts are separate from match actions and match metrics.
- Do not sum percentages; recompute from their numerators and denominators.
- Missing coordinates and unknown outcomes remain missing.
- No reliable minutes denominator; per-90 metrics are unsupported.
- Shot goals exclude own goals; team goals_for is the match score.
