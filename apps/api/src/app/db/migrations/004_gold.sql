CREATE SCHEMA IF NOT EXISTS gold;
CREATE TABLE IF NOT EXISTS gold.source_load (
    load_id text PRIMARY KEY,
    dataset text NOT NULL UNIQUE CHECK (dataset='statsbomb-wc2022-gold'),
    gold_version integer NOT NULL,
    base_load_id text NOT NULL REFERENCES silver.source_load(load_id),
    lineup_load_id text NOT NULL REFERENCES silver_lineups.source_load(load_id),
    quality_load_id text NOT NULL REFERENCES silver.quality_load(quality_load_id),
    definitions_sha256 text NOT NULL,
    loaded_at timestamptz NOT NULL DEFAULT now(),
    manifest jsonb NOT NULL,
    quality_report jsonb NOT NULL,
    metric_catalog jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS gold.initial_lineups (
    match_id integer NOT NULL REFERENCES silver.matches,
    team_id integer NOT NULL REFERENCES silver.teams,
    source_event_id uuid NOT NULL,
    formation_code integer NOT NULL,
    player_ids jsonb NOT NULL CHECK (jsonb_array_length(player_ids)=11),
    players jsonb NOT NULL,
    PRIMARY KEY(match_id,team_id),
    FOREIGN KEY(match_id,source_event_id) REFERENCES silver.events
);
CREATE TABLE IF NOT EXISTS gold.lineup_changes (
    match_id integer NOT NULL,
    team_id integer NOT NULL,
    event_id uuid NOT NULL,
    event_index integer NOT NULL,
    period smallint NOT NULL CHECK(period BETWEEN 1 AND 4),
    timestamp text NOT NULL,
    change_type text NOT NULL,
    player_id integer,
    replacement_id integer,
    before jsonb NOT NULL,
    after jsonb NOT NULL,
    PRIMARY KEY(match_id,event_id),
    FOREIGN KEY(match_id,team_id) REFERENCES gold.initial_lineups,
    FOREIGN KEY(match_id,event_id) REFERENCES silver.events
);
CREATE TABLE IF NOT EXISTS gold.lineup_segments (
    segment_id text PRIMARY KEY,
    match_id integer NOT NULL,
    team_id integer NOT NULL,
    start_event_index integer NOT NULL,
    end_event_index_exclusive integer NOT NULL,
    source_event_id uuid NOT NULL,
    selected_player_ids jsonb NOT NULL,
    on_field_player_ids jsonb NOT NULL,
    temporarily_off_player_ids jsonb NOT NULL,
    last_declared_formation integer NOT NULL,
    formation_current boolean NOT NULL,
    declared_positions jsonb NOT NULL,
    declared_player_ids jsonb NOT NULL,
    tactical_snapshot_issues jsonb NOT NULL,
    declaration_event_id uuid NOT NULL,
    UNIQUE(match_id,team_id,start_event_index),
    CHECK(start_event_index < end_event_index_exclusive),
    CHECK(jsonb_array_length(on_field_player_ids)<=11),
    FOREIGN KEY(match_id,team_id) REFERENCES gold.initial_lineups,
    FOREIGN KEY(match_id,source_event_id) REFERENCES silver.events,
    FOREIGN KEY(match_id,declaration_event_id) REFERENCES silver.events
);
CREATE TABLE IF NOT EXISTS gold.actions (
    match_id integer NOT NULL,
    event_id uuid NOT NULL,
    event_index integer NOT NULL,
    period smallint NOT NULL CHECK(period BETWEEN 1 AND 4),
    minute integer NOT NULL,
    second integer NOT NULL,
    seconds_in_period double precision NOT NULL,
    team_id integer NOT NULL,
    player_id integer,
    type_name text NOT NULL,
    location_x double precision,
    location_y double precision,
    end_x double precision,
    end_y double precision,
    recipient_id integer,
    outcome_name text,
    is_complete boolean,
    under_pressure boolean NOT NULL,
    off_camera boolean NOT NULL,
    possession integer NOT NULL,
    possession_team_id integer NOT NULL,
    play_pattern_name text NOT NULL,
    shot_type text,
    is_penalty boolean,
    is_goal boolean,
    statsbomb_xg double precision CHECK(statsbomb_xg BETWEEN 0 AND 1),
    actor_on_field boolean NOT NULL,
    lineup_segment_id text NOT NULL REFERENCES gold.lineup_segments,
    clock_reliable boolean NOT NULL,
    quality_rule_ids jsonb NOT NULL,
    goal_difference_before integer NOT NULL,
    metrics jsonb NOT NULL,
    PRIMARY KEY(match_id,event_id),
    UNIQUE(match_id,event_index),
    FOREIGN KEY(match_id,event_id) REFERENCES silver.events,
    FOREIGN KEY(match_id,team_id) REFERENCES gold.initial_lineups
);
CREATE TABLE IF NOT EXISTS gold.player_match (
    match_id integer NOT NULL,
    team_id integer NOT NULL,
    player_id integer NOT NULL,
    player_name text NOT NULL,
    opponent_id integer NOT NULL,
    is_starter boolean NOT NULL,
    appeared boolean NOT NULL,
    metrics jsonb NOT NULL,
    PRIMARY KEY(match_id,team_id,player_id),
    FOREIGN KEY(match_id,team_id,player_id) REFERENCES silver_lineups.match_rosters
);
CREATE TABLE IF NOT EXISTS gold.team_match (
    match_id integer NOT NULL,
    team_id integer NOT NULL,
    team_name text NOT NULL,
    opponent_id integer NOT NULL,
    opponent_name text NOT NULL,
    match_date date NOT NULL,
    stage_name text NOT NULL,
    is_home boolean NOT NULL,
    goals_for integer NOT NULL CHECK(goals_for>=0),
    goals_against integer NOT NULL CHECK(goals_against>=0),
    initial_formation integer NOT NULL,
    metrics jsonb NOT NULL,
    PRIMARY KEY(match_id,team_id),
    FOREIGN KEY(match_id,team_id) REFERENCES gold.initial_lineups
);
CREATE TABLE IF NOT EXISTS gold.receipts (
    match_id integer NOT NULL,
    event_id uuid NOT NULL,
    team_id integer NOT NULL,
    player_id integer NOT NULL,
    passer_id integer NOT NULL,
    lineup_segment_id text NOT NULL REFERENCES gold.lineup_segments,
    location_x double precision NOT NULL,
    location_y double precision NOT NULL,
    PRIMARY KEY(match_id,event_id),
    FOREIGN KEY(match_id,event_id) REFERENCES gold.actions,
    FOREIGN KEY(match_id,team_id,player_id) REFERENCES gold.player_match
);
CREATE TABLE IF NOT EXISTS gold.shot_creations (
    match_id integer NOT NULL,
    shot_event_id uuid NOT NULL,
    pass_event_id uuid NOT NULL,
    team_id integer NOT NULL,
    creator_id integer NOT NULL,
    shooter_id integer NOT NULL,
    statsbomb_xg double precision NOT NULL CHECK(statsbomb_xg BETWEEN 0 AND 1),
    PRIMARY KEY(match_id,shot_event_id),
    FOREIGN KEY(match_id,shot_event_id) REFERENCES gold.actions,
    FOREIGN KEY(match_id,pass_event_id) REFERENCES gold.actions
);
CREATE TABLE IF NOT EXISTS gold.connections (
    match_id integer NOT NULL,
    team_id integer NOT NULL,
    player_id integer NOT NULL,
    recipient_id integer NOT NULL,
    pass_count integer NOT NULL CHECK(pass_count>0),
    mean_start_x double precision NOT NULL,
    mean_start_y double precision NOT NULL,
    mean_end_x double precision NOT NULL,
    mean_end_y double precision NOT NULL,
    source_event_ids jsonb NOT NULL,
    PRIMARY KEY(match_id,team_id,player_id,recipient_id),
    CHECK(pass_count=jsonb_array_length(source_event_ids)),
    FOREIGN KEY(match_id,team_id,player_id) REFERENCES gold.player_match,
    FOREIGN KEY(match_id,team_id,recipient_id) REFERENCES gold.player_match
);
CREATE TABLE IF NOT EXISTS gold.segment_player_metrics (
    segment_id text NOT NULL REFERENCES gold.lineup_segments,
    player_id integer NOT NULL,
    metrics jsonb NOT NULL,
    PRIMARY KEY(segment_id,player_id)
);
CREATE TABLE IF NOT EXISTS gold.shootout_actions (
    match_id integer NOT NULL,
    event_id uuid NOT NULL,
    event_index integer NOT NULL,
    team_id integer NOT NULL,
    player_id integer,
    type_name text NOT NULL,
    is_shot boolean NOT NULL,
    is_goal boolean NOT NULL,
    PRIMARY KEY(match_id,event_id),
    FOREIGN KEY(match_id,event_id) REFERENCES silver.events
);
CREATE INDEX IF NOT EXISTS gold_actions_player_idx ON gold.actions(player_id,match_id,event_index);
CREATE INDEX IF NOT EXISTS gold_actions_segment_idx ON gold.actions(lineup_segment_id,player_id);
CREATE INDEX IF NOT EXISTS gold_player_match_idx ON gold.player_match(player_id,match_id);
CREATE INDEX IF NOT EXISTS gold_receipts_player_idx ON gold.receipts(player_id,match_id);

CREATE OR REPLACE VIEW gold.shot_map AS SELECT * FROM gold.actions WHERE type_name='Shot';
CREATE OR REPLACE VIEW gold.action_map AS SELECT * FROM gold.actions WHERE player_id IS NOT NULL AND location_x IS NOT NULL;
CREATE OR REPLACE VIEW gold.creation_map AS
SELECT c.*,p.event_index AS pass_index,p.period,p.minute,p.second,
       p.location_x AS pass_start_x,p.location_y AS pass_start_y,p.end_x AS pass_end_x,p.end_y AS pass_end_y,
       p.under_pressure,p.off_camera,p.play_pattern_name,p.quality_rule_ids,
       s.location_x AS shot_x,s.location_y AS shot_y,s.is_goal,s.is_penalty,
       p.lineup_segment_id
FROM gold.shot_creations c
JOIN gold.actions p ON (p.match_id,p.event_id)=(c.match_id,c.pass_event_id)
JOIN gold.actions s ON (s.match_id,s.event_id)=(c.match_id,c.shot_event_id);
CREATE OR REPLACE VIEW gold.receipt_map AS
SELECT r.*,p.event_index,p.period,p.minute,p.second,p.off_camera,p.quality_rule_ids,p.play_pattern_name
FROM gold.receipts r JOIN gold.actions p USING(match_id,event_id);
CREATE OR REPLACE VIEW gold.player_metric_values AS
SELECT p.match_id,p.team_id,p.player_id,p.player_name,p.opponent_id,p.is_starter,p.appeared,
       v.key AS metric_code,v.value::double precision AS value
FROM gold.player_match p CROSS JOIN LATERAL jsonb_each_text(p.metrics) v;
CREATE OR REPLACE VIEW gold.team_match_comparison AS
SELECT t.*,o.metrics AS opponent_metrics FROM gold.team_match t
JOIN gold.team_match o ON (o.match_id,o.team_id)=(t.match_id,t.opponent_id);
CREATE OR REPLACE VIEW gold.player_match_context AS
SELECT p.*,t.match_date,t.stage_name,t.opponent_name,t.goals_for,t.goals_against,
       i.formation_code,i.player_ids AS starter_ids,i.source_event_id AS lineup_source_event_id
FROM gold.player_match p JOIN gold.team_match t USING(match_id,team_id)
JOIN gold.initial_lineups i USING(match_id,team_id);
CREATE OR REPLACE VIEW gold.segment_player_context AS
SELECT s.*,p.player_id,p.metrics FROM gold.lineup_segments s
JOIN gold.segment_player_metrics p USING(segment_id);
CREATE OR REPLACE VIEW gold.xg_timeline AS
SELECT match_id,event_id,event_index,period,minute,second,seconds_in_period,team_id,player_id,
       statsbomb_xg,is_goal,is_penalty,clock_reliable,
       sum(statsbomb_xg) OVER(PARTITION BY match_id,team_id ORDER BY event_index ROWS UNBOUNDED PRECEDING) AS cumulative_xg
FROM gold.shot_map;
