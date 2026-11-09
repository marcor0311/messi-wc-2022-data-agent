-- One immutable snapshot of StatsBomb's men's World Cup 2022.
CREATE SCHEMA IF NOT EXISTS silver;

CREATE TABLE IF NOT EXISTS silver.source_load (
    load_id text PRIMARY KEY,
    dataset text NOT NULL UNIQUE CHECK (dataset = 'statsbomb-wc2022'),
    transform_version integer NOT NULL,
    source_commit text NOT NULL,
    source_manifest_sha256 text NOT NULL,
    loaded_at timestamptz NOT NULL DEFAULT now(),
    manifest jsonb NOT NULL,
    quality_report jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS silver.teams (
    team_id integer PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS silver.players (
    player_id integer PRIMARY KEY,
    name text NOT NULL,
    aliases text[] NOT NULL
);

CREATE TABLE IF NOT EXISTS silver.matches (
    match_id integer PRIMARY KEY,
    competition_id integer NOT NULL CHECK (competition_id = 43),
    season_id integer NOT NULL CHECK (season_id = 106),
    match_date date NOT NULL,
    kick_off time NOT NULL,
    home_team_id integer NOT NULL REFERENCES silver.teams,
    away_team_id integer NOT NULL REFERENCES silver.teams,
    home_score integer NOT NULL CHECK (home_score >= 0),
    away_score integer NOT NULL CHECK (away_score >= 0),
    stage_name text NOT NULL,
    source_file text NOT NULL,
    load_id text NOT NULL REFERENCES silver.source_load,
    CHECK (home_team_id <> away_team_id)
);

CREATE TABLE IF NOT EXISTS silver.events (
    match_id integer NOT NULL REFERENCES silver.matches,
    event_id uuid NOT NULL,
    event_index integer NOT NULL CHECK (event_index > 0),
    period smallint NOT NULL CHECK (period BETWEEN 1 AND 5),
    minute smallint NOT NULL CHECK (minute >= 0),
    second smallint NOT NULL CHECK (second BETWEEN 0 AND 59),
    seconds_in_period numeric(12,3) NOT NULL CHECK (seconds_in_period >= 0),
    type_id integer NOT NULL,
    type_name text NOT NULL,
    team_id integer NOT NULL REFERENCES silver.teams,
    player_id integer REFERENCES silver.players,
    position_id integer,
    position_name text,
    possession integer NOT NULL,
    possession_team_id integer NOT NULL REFERENCES silver.teams,
    play_pattern_id integer NOT NULL,
    play_pattern_name text NOT NULL,
    duration double precision CHECK (duration >= 0),
    location_x double precision CHECK (location_x BETWEEN 0 AND 120),
    location_y double precision CHECK (location_y BETWEEN 0 AND 80),
    under_pressure boolean NOT NULL,
    counterpress boolean NOT NULL,
    off_camera boolean NOT NULL,
    out boolean NOT NULL,
    is_shootout boolean GENERATED ALWAYS AS (period = 5) STORED,
    raw_payload jsonb NOT NULL,
    PRIMARY KEY (match_id, event_id),
    UNIQUE (match_id, event_index),
    CHECK ((location_x IS NULL) = (location_y IS NULL))
);

CREATE TABLE IF NOT EXISTS silver.passes (
    match_id integer NOT NULL,
    event_id uuid NOT NULL,
    recipient_id integer REFERENCES silver.players,
    length double precision NOT NULL CHECK (length >= 0),
    angle double precision NOT NULL,
    height_name text NOT NULL,
    body_part_name text,
    type_name text,
    outcome_name text,
    is_complete boolean,
    end_x double precision NOT NULL CHECK (end_x BETWEEN 0 AND 120),
    end_y double precision NOT NULL CHECK (end_y BETWEEN 0 AND 80),
    shot_assist boolean NOT NULL,
    goal_assist boolean NOT NULL,
    assisted_shot_id uuid,
    cross_pass boolean NOT NULL,
    cut_back boolean NOT NULL,
    switch_pass boolean NOT NULL,
    through_ball boolean NOT NULL,
    PRIMARY KEY (match_id, event_id),
    FOREIGN KEY (match_id, event_id) REFERENCES silver.events,
    FOREIGN KEY (match_id, assisted_shot_id) REFERENCES silver.events,
    CHECK (is_complete IS NOT DISTINCT FROM
           CASE WHEN outcome_name IS NULL THEN true
                WHEN outcome_name = 'Unknown' THEN NULL::boolean
                ELSE false END)
);

CREATE TABLE IF NOT EXISTS silver.shots (
    match_id integer NOT NULL,
    event_id uuid NOT NULL,
    statsbomb_xg double precision NOT NULL CHECK (statsbomb_xg BETWEEN 0 AND 1),
    outcome_name text NOT NULL,
    body_part_name text NOT NULL,
    type_name text NOT NULL,
    technique_name text NOT NULL,
    end_x double precision NOT NULL,
    end_y double precision NOT NULL,
    end_z double precision,
    key_pass_id uuid,
    is_goal boolean NOT NULL,
    is_penalty boolean NOT NULL,
    PRIMARY KEY (match_id, event_id),
    FOREIGN KEY (match_id, event_id) REFERENCES silver.events,
    FOREIGN KEY (match_id, key_pass_id) REFERENCES silver.events,
    CHECK (is_goal = (outcome_name = 'Goal')),
    CHECK (is_penalty = (type_name = 'Penalty'))
);

CREATE INDEX IF NOT EXISTS events_player_match_idx ON silver.events (player_id, match_id);
CREATE INDEX IF NOT EXISTS events_team_type_idx ON silver.events (team_id, type_id);
CREATE INDEX IF NOT EXISTS passes_recipient_idx ON silver.passes (recipient_id);

-- Period 5 is a shootout. Keep it in Silver, but exclude it from match statistics.
CREATE OR REPLACE VIEW silver.match_events AS
SELECT * FROM silver.events WHERE NOT is_shootout;

CREATE OR REPLACE VIEW silver.match_shots AS
SELECT s.*, e.player_id, e.team_id, e.period
FROM silver.shots s
JOIN silver.events e USING (match_id, event_id)
WHERE NOT e.is_shootout;
