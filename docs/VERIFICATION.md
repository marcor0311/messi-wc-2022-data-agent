# Verification report

Product scope: Messi at the 2022 World Cup, with opponent/player/team and starting-XI comparisons as context. Desktop only.

## Verified

- Gold discovery: 11 datasets, 234,531 match actions, 64 matches, 32 teams, 833 roster players. Both local Gold snapshots were inspected; all file checksums match between snapshots, while their definitions hashes differ. The selected `4f7a541c…` snapshot and its definitions hash are pinned in catalog/provenance.
- Serving cache: source checksums verified before materialization; SQLite cache SHA-256/version verified before loading. Reusable pitch-density aggregates precomputed; equivalence with raw reception coordinates tested.
- 27 executed Messi-centered deterministic scenarios; reproducible queries, dataset hashes and counts in `DEMO_SCENARIOS.json`. This is tool/data verification, not a claim of verified live natural-language model routing.
- Independently read raw Gold actions: Messi totals are 32 shots, 7 shot goals, 6.031649225 xG, 2.114149225 npxG, and 3 provider assists (the latter from match metric records). Shootouts remain separate. Messi/Mbappé final non-penalty comparisons and both declared starting XIs are independently checked against raw Gold.
- API suite: **67 passed**. Includes statistical correctness, ratios, novel recovery/pressure questions, all view contracts, unsafe/invalid query rejection, missing/empty/truncated results, cached spatial equivalence, mocked tool loop and follow-up context, real cryptographic JWT validation with test keys, PKCE/state/nonce/audience/replay/expiry checks, mocked exchange/refresh rotation, logout, Origin rejection, unauthenticated chat denial, and failed/incomplete stream handling.
- Browser suite: **7 passed** using actual local Next.js + FastAPI + Gold, without mocking analytics. Validates Messi selected on entry, all eight registered views, exact-data table, axe accessibility (zero violations on tested state), and desktop viewports 1440×800, 1440×1000, 1920×1080. Both starting XIs of a match render on separately labelled pitches with non-overlapping names and Messi highlighted. One test drives the conversation UI with two dashboards of eight real Gold results (stat cards, shot map, per-metric comparison and evolution panels, both starting XIs, pass network, activity zones, match timeline): suggestion, question, model and explanation-level switch, follow-up with the same conversation, inference error next to the composer, history restored after reload, and no horizontal overflow at 1920×1080 and 1440×800. Its session, model list and answer text are mocked; its visualizations are real Gold query results. Screenshots saved under ignored `apps/web/test-results/` and visually inspected.
- TypeScript check passed. Production build compiled and emitted `/agent` alongside existing routes.

Commands:

```sh
.venv/bin/python scripts/discover_gold.py
.venv/bin/python scripts/generate_demo.py
.venv/bin/python -m pytest apps/api/tests -q
npm --prefix apps/web run typecheck
NEXT_DIST_DIR=.next-agent-build npm --prefix apps/web run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm --prefix apps/web run test:e2e -- tests/data-agent.spec.ts --project=desktop --workers=1
```

## Live authorization and inference

**Authentication status: verified with a real ChatGPT account on 2026-11-16. Verified live model: `gpt-6.1-sol`.**

The account owner completed the official sign-in and consent in their own browser through “Continue with ChatGPT”. Dynamic client registration, the code exchange, signed ID-token validation and the session cookie all succeeded. Granted scopes: `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct`. The account catalog at `/v1/models` listed eight models, in server order: `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6.1-terra`, `gpt-6-sol`, `gpt-6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`.

Four questions ran through the real model and tool loop (`DataAgent.answer`, the same code path as `/api/agent/chat`) as one conversation. Every number in the answers was then recomputed from the raw Gold JSONL files, independently of the serving cache:

| Question | Tools the model chose | Answer vs raw Gold | Time |
|---|---|---|---|
| ¿Cuántos tiros, goles y xG sumó Messi en todo el Mundial? | `find_entities` → `describe_data` → `query_gold` (table, `player_match`) | 32 shots, 7 goals, 6.03 xG: exact | 12 s |
| ¿Y sin contar los penales? (follow-up, no player named) | same three tools, `non_penalty_*` metrics and `npxg` | 27 shots, 3 goals, 2.11 npxG: exact | 13 s |
| Compara los tiros sin penal de Messi y Mbappé en la final y muéstralos en la cancha. | three `find_entities`, `describe_data`, one rejected `query_gold`, one repaired `query_gold` (pitch, `actions`) | 4 shots and 1 goal each, 0.67 vs 0.22 xG, outcomes and the 8 plotted events: exact | 25 s |
| Muestra los onces iniciales de Argentina y Países Bajos en los cuartos de final. | `find_entities` → `describe_data` → `query_gold` (lineup, both teams) | 3-5-2 and 3-4-1-2, all 22 players and positions: exact | 17 s |

The follow-up kept Messi and the tournament scope without restating them. In the third question the model first sent `columns` with a visual view, received the validation error and repaired the call by itself, as designed.

`gpt-6.1-sol` is the first entry of the account catalog, which is the app default, so the default model is the verified one. The other seven models are selectable but were not exercised. No latency or quality comparison between models was run.

### After the visualization and audience rework

The account owner then tried two questions in the browser with `gpt-6-luna` and reported poor charts: a shot question came back as a raw table with a Markdown table in the text, and a two-metric evolution shared one chart behind a selector. After the rework (chart-selection rules, human titles, automatic map for event listings, one panel per metric, explanation levels, names sent with every result), five more real questions were run:

| Model · level | Question | Result |
|---|---|---|
| `gpt-6-luna` · fan | Muestra los tiros de Lionel Messi durante el Mundial, con su xG. | Titled shot map, 32 shots; plain two-sentence answer |
| `gpt-6.1-sol` · analyst | Compara a Messi y Mbappé en la final. | Ten-metric comparison; every figure in the text matches the returned rows |
| `gpt-6-luna` · simple | ¿Con qué compañeros se buscó más Messi en la final? | **First run wrong**: the text named Álvarez with 5 passes while the rows say De Paul 12, Enzo Fernández 8, Mac Allister 6. The chart was right. Cause: rows carried only IDs. Fixed by sending a names lookup with each result and ordering networks by pass count |
| `gpt-6-luna` · simple | Same question after the fix | Network filtered to Messi; De Paul 12, Enzo Fernández 8, Mac Allister 6: exact |
| `gpt-6-luna` · fan | ¿Cómo cambió el peligro que generó Messi partido a partido? | Six-metric evolution; stated maximum (final) and minimum (Mexico) match the rows |

Model text can still misread results; the returned rows and the exact-data table remain the evidence. The lighter model needed one or two repaired tool calls per question.

Not exercised live: token refresh after expiry, logout with remote revocation, and a question typed in the browser against the real session (the browser conversation path is covered by the mocked-session test above). The protocol tests cover refresh and logout with mocks.

## Limits

The system does not provide tracking, speed, distance, physical workload or per-90 measures. Heatmaps count event locations, not time occupancy. Starting positions are schematic declarations. Networks use recorded mean pass locations. Query results have explicit row limits and provenance. Model-generated explanations may err and require checking against the returned evidence. The model tool loop and auth protocol tests use declared mocks where real credentials are unnecessary; the live flow above was checked separately. The local credential store supports one API process, not concurrent workers or public hosting.

Existing tests emit 13 upstream LangSmith/Python deprecation warnings. No test failure is hidden by those warnings.
