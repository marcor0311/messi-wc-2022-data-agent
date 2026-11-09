-- Complementary dataset: never replaces silver.players or the audited event load.
CREATE SCHEMA IF NOT EXISTS silver_lineups;

CREATE TABLE IF NOT EXISTS silver_lineups.source_load (
    load_id text PRIMARY KEY,
    dataset text NOT NULL UNIQUE CHECK (dataset = 'statsbomb-wc2022-lineups'),
    parent_load_id text NOT NULL REFERENCES silver.source_load(load_id),
    source_commit text NOT NULL,
    source_manifest_sha256 text NOT NULL,
    transform_version integer NOT NULL,
    manifest jsonb NOT NULL,
    quality_report jsonb NOT NULL,
    loaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS silver_lineups.players (
    player_id integer PRIMARY KEY,
    name text NOT NULL,
    aliases text[] NOT NULL,
    nicknames text[] NOT NULL,
    load_id text NOT NULL REFERENCES silver_lineups.source_load
);

CREATE TABLE IF NOT EXISTS silver_lineups.match_rosters (
    match_id integer NOT NULL REFERENCES silver.matches,
    team_id integer NOT NULL REFERENCES silver.teams,
    player_id integer NOT NULL REFERENCES silver_lineups.players,
    player_name text NOT NULL,
    player_nickname text,
    jersey_number smallint NOT NULL CHECK (jersey_number > 0),
    country_id integer,
    country_name text,
    is_starter boolean NOT NULL,
    has_position_spells boolean NOT NULL,
    source_file text NOT NULL,
    raw_payload jsonb NOT NULL,
    load_id text NOT NULL REFERENCES silver_lineups.source_load,
    PRIMARY KEY (match_id, team_id, player_id),
    UNIQUE (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS silver_lineups.position_spells (
    match_id integer NOT NULL,
    team_id integer NOT NULL,
    player_id integer NOT NULL,
    spell_index integer NOT NULL CHECK (spell_index > 0),
    position_id integer NOT NULL,
    position_name text NOT NULL,
    from_clock text NOT NULL,
    to_clock text,
    from_clock_seconds integer NOT NULL CHECK (from_clock_seconds >= 0),
    to_clock_seconds integer CHECK (to_clock_seconds >= 0),
    from_period smallint NOT NULL CHECK (from_period BETWEEN 1 AND 5),
    to_period smallint CHECK (to_period BETWEEN 1 AND 5),
    start_reason text NOT NULL,
    end_reason text NOT NULL,
    raw_payload jsonb NOT NULL,
    PRIMARY KEY (match_id, team_id, player_id, spell_index),
    FOREIGN KEY (match_id, team_id, player_id) REFERENCES silver_lineups.match_rosters
    -- No inferred minutes, interval union or ordering constraint: preserve source anomalies.
);

CREATE TABLE IF NOT EXISTS silver_lineups.cards (
    match_id integer NOT NULL,
    team_id integer NOT NULL,
    player_id integer NOT NULL,
    card_index integer NOT NULL CHECK (card_index > 0),
    clock text NOT NULL,
    clock_seconds integer NOT NULL CHECK (clock_seconds >= 0),
    period smallint NOT NULL CHECK (period BETWEEN 1 AND 5),
    card_type text NOT NULL,
    reason text NOT NULL,
    raw_payload jsonb NOT NULL,
    PRIMARY KEY (match_id, team_id, player_id, card_index),
    FOREIGN KEY (match_id, team_id, player_id) REFERENCES silver_lineups.match_rosters
);

CREATE INDEX IF NOT EXISTS rosters_player_match_idx ON silver_lineups.match_rosters (player_id, match_id);
