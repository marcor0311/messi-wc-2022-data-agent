-- Additive quality observations. Original event tables and payloads stay intact.
CREATE TABLE IF NOT EXISTS silver.quality_load (
    quality_load_id text PRIMARY KEY,
    parent_load_id text NOT NULL UNIQUE REFERENCES silver.source_load(load_id),
    quality_version integer NOT NULL CHECK (quality_version > 0),
    loaded_at timestamptz NOT NULL DEFAULT now(),
    manifest jsonb NOT NULL,
    quality_report jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS silver.quality_rules (
    quality_load_id text NOT NULL REFERENCES silver.quality_load,
    rule_id text NOT NULL,
    code text NOT NULL,
    classification text NOT NULL CHECK (classification IN
        ('source_error','review_candidate','source_limitation','expected_behavior','context')),
    grain text NOT NULL CHECK (grain IN ('event','event_relation','player')),
    description text NOT NULL,
    handling text NOT NULL,
    PRIMARY KEY (quality_load_id,rule_id),
    UNIQUE (quality_load_id,code)
);

-- An event may have several observations; relation observations include a target.
CREATE TABLE IF NOT EXISTS silver.event_quality_issues (
    quality_load_id text NOT NULL,
    issue_id text PRIMARY KEY,
    rule_id text NOT NULL,
    match_id integer NOT NULL,
    event_id uuid NOT NULL,
    related_event_id uuid,
    evidence jsonb NOT NULL,
    FOREIGN KEY (quality_load_id,rule_id) REFERENCES silver.quality_rules,
    FOREIGN KEY (match_id,event_id) REFERENCES silver.events,
    FOREIGN KEY (match_id,related_event_id) REFERENCES silver.events
);

CREATE TABLE IF NOT EXISTS silver.player_quality_issues (
    quality_load_id text NOT NULL,
    player_id integer NOT NULL REFERENCES silver.players,
    rule_id text NOT NULL,
    evidence jsonb NOT NULL,
    PRIMARY KEY (quality_load_id,player_id,rule_id),
    FOREIGN KEY (quality_load_id,rule_id) REFERENCES silver.quality_rules
);

CREATE INDEX IF NOT EXISTS event_quality_lookup_idx
    ON silver.event_quality_issues(match_id,event_id,rule_id);
CREATE INDEX IF NOT EXISTS event_quality_rule_idx
    ON silver.event_quality_issues(quality_load_id,rule_id);

CREATE OR REPLACE VIEW silver.quality_summary AS
WITH observations AS (
    SELECT quality_load_id,rule_id,count(*) AS observation_count
    FROM silver.event_quality_issues GROUP BY quality_load_id,rule_id
    UNION ALL
    SELECT quality_load_id,rule_id,count(*) AS observation_count
    FROM silver.player_quality_issues GROUP BY quality_load_id,rule_id
)
SELECT r.*, coalesce(o.observation_count,0)::bigint AS observation_count
FROM silver.quality_rules r
LEFT JOIN observations o USING (quality_load_id,rule_id);

-- Raw context, not metric eligibility. NULL means the recovery flag is inapplicable.
CREATE OR REPLACE VIEW silver.events_with_context AS
SELECT e.*,
       CASE WHEN e.type_id=2
            THEN coalesce((e.raw_payload->'ball_recovery'->>'recovery_failure')::boolean,false)
       END AS ball_recovery_failure
FROM silver.events e;

-- One row per event; joining this view cannot multiply an event's rows.
CREATE OR REPLACE VIEW silver.event_quality_status AS
SELECT e.match_id,e.event_id,
       coalesce(q.has_source_error,false) AS has_source_error,
       coalesce(q.has_review_candidate,false) AS has_review_candidate,
       coalesce(q.rule_ids,ARRAY[]::text[]) AS rule_ids
FROM silver.events e
LEFT JOIN (
    SELECT i.match_id,i.event_id,
           bool_or(r.classification='source_error') AS has_source_error,
           bool_or(r.classification='review_candidate') AS has_review_candidate,
           array_agg(DISTINCT i.rule_id ORDER BY i.rule_id) AS rule_ids
    FROM silver.event_quality_issues i
    JOIN silver.quality_rules r USING (quality_load_id,rule_id)
    GROUP BY i.match_id,i.event_id
) q USING (match_id,event_id);
