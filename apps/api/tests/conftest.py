import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from app.agent.graph import build_agent
from app.db.conversations import ConversationStore
from app.db.gold import GoldRepository
from app.main import app, get_agent, get_gold, get_store


@pytest.fixture
def artifact(tmp_path):
    folder = tmp_path / "gold"
    folder.mkdir()
    def shot(identity, pid, x, *, penalty=False, goal=False, period=1, match=1, xg=.2):
        return dict(event_id=identity, match_id=match, player_id=pid, type_name="Shot", period=period,
                    location_x=x, location_y=40 if x is not None else None, minute=23, second=12,
                    end_x=120, end_y=41.8 if goal else 45.5,
                    statsbomb_xg=xg, outcome_name="Goal" if goal else "Saved", is_goal=goal,
                    is_penalty=penalty, quality_rule_ids=[], clock_reliable=True)
    tables = {
        "actions": [shot("messi-penalty", 5503, 108, penalty=True, goal=True, xg=.78),
                    shot("messi-open", 5503, 112, goal=True), shot("messi-wide", 5503, 99),
                    shot("mbappe-penalty", 3009, 108, penalty=True, xg=.78),
                    shot("mbappe-open", 3009, 101, goal=True, xg=.1),
                    shot("shootout", 5503, 108, penalty=True, goal=True, period=5),
                    shot("other-match", 5503, 108, goal=True, match=2)],
        "player_match": [dict(player_id=5503, player_name="Lionel Andrés Messi Cuccittini"),
                         dict(player_id=3009, player_name="Kylian Mbappé Lottin")],
        "team_match": [dict(match_id=1, stage_name="Final", team_name="Argentina", opponent_name="France", match_date="2022-12-18"),
                       dict(match_id=2, stage_name="Semi-finals", team_name="Argentina", opponent_name="Croatia", match_date="2022-12-13")],
    }
    for name, records in tables.items():
        (folder / f"{name}.jsonl").write_text("\n".join(json.dumps(r) for r in records) + "\n")
    seal(folder)
    return folder


def seal(folder):
    manifest = dict(gold_version=1, dataset="statsbomb-wc2022-gold", load_id="fixture-load",
                    definitions_sha256="fixture-definitions", source_commit="fixture-commit",
                    source_load_ids={"base": "fixture-silver"},
                    files={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.glob("*.jsonl")})
    (folder / "manifest.json").write_text(json.dumps(manifest))


@pytest.fixture
def gold(artifact):
    return GoldRepository(artifact)


@pytest.fixture
def client(tmp_path, gold):
    store = ConversationStore(tmp_path / "conversations.sqlite3")
    app.dependency_overrides[get_gold] = lambda: gold
    app.dependency_overrides[get_agent] = lambda: build_agent(gold)
    app.dependency_overrides[get_store] = lambda: store
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    app.dependency_overrides.clear()
