# Messi Football Data Agent

The product centers on Lionel Messi at Qatar 2022. Other entities provide comparisons and match context. `/agent` is the new workspace; the museum and bounded legacy `/analisis` remain independent.

## Data discovery and preparation

`scripts/discover_gold.py` verifies every manifest checksum, profiles all eleven Gold JSONL tables and every top-level/metric column, records types/nulls/ranges/categorical values, and builds an indexed read-only SQLite serving database. The newest local Gold manifest is selected unless `--gold` pins a folder. The two local Gold versions have identical dataset file checksums but different definitions hashes; the active load is recorded in generated documentation. Metric dictionaries are flattened without altering original Gold. Tactical player arrays and quality/context records retain JSON structure.

Run discovery before a demo, never inside a conversation. The immutable snapshot, indexed filters, existing Gold player/team match aggregates and passing connections do the heavy work before questions. Spatial bins are precomputed at match/team/player/type/period dimensions. Compatible heatmaps use those caches; novel extra filters use bounded raw aggregations. The serving database checksum and cache version are verified before loading. The full ETL is never invoked by a request.

## Tools and model

`find_entities` resolves real IDs. `describe_data` supplies schemas and definitions. `query_gold` accepts a Pydantic contract, validates every identifier against the discovered schema and binds every value as a SQL parameter. The LLM cannot issue SQL, scripts, frontend code or unrestricted filesystem operations. Limits bound filters, groups, metrics, rows and SQLite instructions. Nulls, unknown outcomes, count scopes, truncation and provenance are explicit. Sparse action metrics follow Gold's zero-contribution convention; raw missing coordinates remain null. Ratios recompute numerator/denominator sums. Direct shot involvement cannot be summed across players.

The Responses loop uses the authenticated account catalog and its selected model, public `https://api.openai.com/v1/responses`, `store:false` and `stream:true`. It accepts results only after `response.completed`; failed, incomplete and interrupted streams fail the turn. Multiple tool calls can discover entities, compare scopes and construct multiple registry visualizations. Conversation history includes previous tool evidence, with a bounded recent context window. Tool errors are returned to the model for repair. Ten reasoning/tool rounds and 100 persisted turns bound a session. No hardcoded question routing or answer cache is used by the new agent.

## Authentication and local security

Official SIWC dynamic public-client registration, stable UUID host, fresh state/nonce/PKCE, loopback callback, issued client ID reuse, signed JWKS ID-token validation (issuer, audience, expiry, nonce), direct-plan scope check, owner-only atomic token files, serialized refresh rotation, HttpOnly SameSite session cookie, and revocation-aware logout are implemented. Tokens are never returned to frontend JavaScript. Saved registrations are separate by client ID and verified subject. API access logging is disabled in the documented commands to keep authorization codes out of logs. No API key and no unofficial ChatGPT backend endpoint exists.

Local-only service: bind to `127.0.0.1`. One API worker owns refreshes and credential writes. `AGENT_CALLBACK` and `AGENT_WEB_ORIGIN` must match the selected loopback ports. Local HTTP cookies are intentionally not Secure; remote deployment requires a separate security design. Browser mutation origins are checked. Deterministic Gold exploration is public to the local process; authenticated chat/history are owner scoped. Legacy prototype endpoints retain their prior behavior.

## Visualization contracts

A server view registry validates compatible source datasets and forbids custom field projections for visual views. The frontend registry renders tables, grouped bars, chronological metric trends, event maps, binned event heatmaps, completed-pass networks, schematic declared starting XIs and recorded-event timelines. Every result includes an accessible exact-data table and reproducible query/source hashes. Filters and interactive data selection refine interpretation. Starting XIs are shown on separately labelled pitches, paginated in pairs for comparisons across teams or matches. These positions are schematic and never presented as tracking coordinates.

## Chart selection, presentation and audiences

The model instructions map the user's intent to a view (events on the pitch, zones, headline numbers, comparison, evolution, partners, starting XI, chronology) and ask for a short human title per query and up to four complementary views per answer. An event listing requested as a table always gets a companion pitch map, added by the server. Every result reaches the model with a names lookup for the player, team and match IDs in its rows.

The frontend renders totals as stat cards, comparisons and evolutions as one panel per metric (never two scales on one axis), shots sized by xG with goals filled, pass networks with one node per player at the mean location of their passes, and a minute strip above the event list. Messi is gold in every view; the pitch and card palettes were checked with the dataviz palette validator. Gold keeps provider values in English and full legal names; the interface shows Spanish labels and the provider's short names from the Silver roster. Each view keeps hover and keyboard detail, an exact-data table and the reproducible query.

The composer offers three explanation levels (simple, fan, analyst or staff) that change how the model writes, not what it queries.

## Verification boundaries

Deterministic Gold integration tests independently read raw JSONL and compare Messi totals, non-penalty shots, tournament metrics, opponent comparisons and both final starting XIs. Mocked tests cover model tool selection, follow-up evidence, signed identity validation, replay/expiry, logout and terminal streaming. Those tests do not prove live OAuth eligibility or live model quality. The live sign-in, catalog discovery and four real question/tool/visualization rounds are recorded in `VERIFICATION.md`.

Official references: [quickstart](https://developers.openai.com/siwc/quickstart), [registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).
