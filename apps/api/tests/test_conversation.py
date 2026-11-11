import json

import pytest
from pydantic import ValidationError

from app.agent.graph import build_agent
from app.agent.models import ShotScope
from app.db.conversations import ConversationStore
from app.db.gold import GoldRepository, GoldUnavailable
from app.main import app, get_agent
from conftest import seal


def create(client):
    response = client.post("/api/conversations")
    assert response.status_code == 201
    return response.json()["id"]


def turn(client, cid, message, base=None, **kwargs):
    response = client.post(f"/api/conversations/{cid}/turns", json=dict(message=message, base_turn_id=base, **kwargs))
    assert response.status_code == 201, response.text
    return response.json()


def test_full_conversation_preserves_final_and_penalties(client):
    cid = create(client)
    first = turn(client, cid, "Muéstrame los tiros de Messi en la final")
    second = turn(client, cid, "Quita los penales", first["id"])
    third = turn(client, cid, "Compáralo con Mbappé", second["id"])
    responses = [t["response"] for t in [first, second, third]]
    assert [r["visualization_action"] for r in responses] == ["create", "update", "update"]
    assert len({r["visualization"]["id"] for r in responses}) == 1
    assert [len(r["visualization"]["data"]["shots"]) for r in responses] == [3, 2, 3]
    assert responses[2]["applied_filters"] == dict(match_id=1, player_ids=[5503, 3009], exclude_penalties=True, period=None)
    assert responses[2]["visualization"]["type"] == "shot_comparison"
    assert responses[2]["tool_name"] == "gold_compare_shots"
    data = responses[2]["visualization"]["data"]
    assert data["summaries"][0]["xg"] == pytest.approx(.4)
    assert data["summaries"][1]["xg"] == pytest.approx(.1)
    assert data["evidence"]["event_ids"] == [s["event_id"] for s in data["shots"]]
    assert all(s["match_id"] == 1 and s["period"] <= 4 and not s["is_penalty"] for s in data["shots"])


def test_restore_snapshot_then_branch_and_reload(client, tmp_path):
    cid = create(client)
    first = turn(client, cid, "Tiros de Messi en la final")
    second = turn(client, cid, "sin penales", first["id"])
    restored = client.post(f"/api/conversations/{cid}/activate", json=dict(turn_id=first["id"], expected_active_turn_id=second["id"]))
    assert restored.status_code == 200
    assert restored.json()["turns"][0] == first
    third = turn(client, cid, "Compáralo con Mbappé", first["id"])
    assert third["parent_turn_id"] == first["id"]
    assert third["response"]["applied_filters"]["exclude_penalties"] is False
    reloaded = ConversationStore(tmp_path / "conversations.sqlite3").get(cid)
    assert reloaded["active_turn_id"] == third["id"]
    assert reloaded["turns"][1] == second
    assert len(reloaded["turns"]) == 3


def test_sessions_are_isolated_and_stale_context_is_rejected(client):
    a, b = create(client), create(client)
    first = turn(client, a, "Tiros de Messi en la final")
    stale = client.post(f"/api/conversations/{a}/turns", json=dict(message="sin penales", base_turn_id=None))
    assert stale.status_code == 409
    stolen = client.post(f"/api/conversations/{b}/activate", json=dict(turn_id=first["id"], expected_active_turn_id=None))
    assert stolen.status_code == 404
    assert client.get(f"/api/conversations/{b}").json()["turns"] == []


@pytest.mark.parametrize("message", ["sin penales", "Compáralo con Mbappé", "Tiros de Messi", "ese tiro"])
def test_missing_context_asks_clarification(client, message):
    result = turn(client, create(client), message)["response"]
    assert result["status"] == "clarification"
    assert result["visualization_action"] == "retain"
    assert result["visualization"] is None


@pytest.mark.parametrize("message", ["Muéstrame los pases", "tiros de Messi en la semifinal", "solo los goles de Messi", "Tiros de Neymar en la final", "Tiros de Messi en la final de 2014", "No quites los penales", "Tiros de Messi bajo presión", "Tiros de Messi en juego abierto"])
def test_unsupported_request_preserves_scope_and_visual(client, message):
    cid = create(client)
    first = turn(client, cid, "Tiros de Messi en la final")
    result = turn(client, cid, message, first["id"])["response"]
    assert result["status"] == "clarification"
    assert result["visualization"] == first["response"]["visualization"]
    assert result["state"] == first["response"]["state"]
    assert result["tool_name"] is None


def test_selected_shot_is_validated_against_active_result(client):
    cid = create(client)
    first = turn(client, cid, "Tiros de Messi en la final")
    valid = turn(client, cid, "Explícame ese tiro", first["id"], selected_event_id="messi-open")
    assert valid["response"]["state"]["selected_event_id"] == "messi-open"
    assert "messi-open" in valid["response"]["explanation"]
    invalid = turn(client, cid, "ese tiro", valid["id"], selected_event_id="other-match")
    assert invalid["response"]["status"] == "clarification"


def test_penalties_can_be_reincluded_without_losing_comparison(client):
    cid = create(client)
    first = turn(client, cid, "Compara tiros de Messi y Mbappé en la final sin penales")
    second = turn(client, cid, "incluye los penales", first["id"])
    assert len(second["response"]["visualization"]["data"]["shots"]) == 5
    assert second["response"]["applied_filters"]["player_ids"] == [5503, 3009]


def test_comparator_preposition_does_not_override_explicit_penalty_filter(client):
    cid = create(client)
    first = turn(client, cid, "Tiros de Messi en la final")
    result = turn(client, cid, "Compáralo con Mbappé sin penales", first["id"])["response"]
    assert result["status"] == "result"
    assert result["applied_filters"]["exclude_penalties"] is True
    assert result["applied_filters"]["player_ids"] == [5503, 3009]


def test_first_mentioned_player_is_comparison_anchor(client):
    first = turn(client, create(client), "Compara tiros de Mbappé y Messi en la final")
    assert first["response"]["applied_filters"]["player_ids"] == [3009, 5503]


def test_empty_result_and_missing_data_are_explicit(artifact):
    path = artifact / "actions.jsonl"
    events = [json.loads(l) for l in path.read_text().splitlines()]
    for row in events:
        if row["event_id"] == "messi-open":
            row["location_x"] = row["location_y"] = row["statsbomb_xg"] = None
    path.write_text("\n".join(json.dumps(r) for r in events))
    seal(artifact)
    gold = GoldRepository(artifact)
    data = gold.gold_shots(ShotScope(match_id=1, player_ids=[5503], exclude_penalties=True))
    assert data.summaries[0].shots == 2
    assert data.summaries[0].unlocated_shots == 1
    assert data.summaries[0].missing_xg == 1
    assert data.summaries[0].xg is None
    empty = gold.gold_shots(ShotScope(match_id=1, player_ids=[5503], period=4))
    assert empty.shots == []
    assert empty.summaries[0].shots == 0
    # Exercise the graph's no-data envelope using a real empty selection.
    gold.shots = []
    response = build_agent(gold).invoke({"message": "Tiros de Messi en la final"})["response"]
    assert response.status == "empty"
    assert response.evidence.event_ids == []


def test_invalid_tool_parameters_and_corrupt_artifact_are_rejected(gold, artifact):
    with pytest.raises(ValueError): gold.gold_shots(ShotScope(match_id=99, player_ids=[5503]))
    with pytest.raises(ValueError): gold.gold_compare_shots(ShotScope(match_id=1, player_ids=[5503, 5503]))
    with pytest.raises(ValueError): gold.gold_shots(ShotScope(match_id=1, player_ids=[999]))
    with pytest.raises(ValidationError): ShotScope(match_id=1, player_ids=[5503], period=5)
    with (artifact / "actions.jsonl").open("a") as stream: stream.write("{}\n")
    with pytest.raises(GoldUnavailable): GoldRepository(artifact)


def test_recoverable_failure_does_not_append_or_lose_result(client):
    cid = create(client)
    first = turn(client, cid, "Tiros de Messi en la final")
    def unavailable(): raise GoldUnavailable("Gold no disponible. Reintenta.")
    app.dependency_overrides[get_agent] = unavailable
    response = client.post(f"/api/conversations/{cid}/turns", json=dict(message="sin penales", base_turn_id=first["id"]))
    assert response.status_code == 503
    assert response.json()["recoverable"] is True
    saved = client.get(f"/api/conversations/{cid}").json()
    assert saved["turns"] == [first]
    assert saved["active_turn_id"] == first["id"]


def test_request_validation(client):
    cid = create(client)
    assert client.post(f"/api/conversations/{cid}/turns", json={"message": "hello"}).status_code == 422
    assert client.post(f"/api/conversations/{cid}/turns", json={"message": "", "base_turn_id": None}).status_code == 422
