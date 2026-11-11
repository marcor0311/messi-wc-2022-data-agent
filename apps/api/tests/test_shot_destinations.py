import hashlib
import json
import copy

import pytest

from app.agent.models import AgentResponse, ShotScope
from app.db.gold import GoldRepository, GoldUnavailable


def companion(artifact):
    """A synthetic Silver parent pinned by the Gold fixture's actual manifest."""
    folder = artifact.parent / "silver"
    folder.mkdir()
    events = [json.loads(line) for line in (artifact / "actions.jsonl").read_text().splitlines()]
    records = [dict(match_id=e["match_id"], event_id=e["event_id"], end_x=e["end_x"],
                    end_y=e["end_y"], end_z=None if e["event_id"] == "messi-wide" else .3)
               for e in events]
    path = folder / "shots.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in records))
    manifest = dict(load_id="fixture-silver", source_commit="fixture-commit",
                    files={"shots.jsonl": hashlib.sha256(path.read_bytes()).hexdigest()})
    (folder / "manifest.json").write_text(json.dumps(manifest))
    gold_path = artifact / "manifest.json"
    gold_manifest = json.loads(gold_path.read_text())
    gold_manifest["source_manifest_hashes"] = {"base": hashlib.sha256((folder / "manifest.json").read_bytes()).hexdigest()}
    gold_path.write_text(json.dumps(gold_manifest))
    return folder


def test_gold_endpoints_and_verified_silver_height_share_the_event_selection(artifact):
    silver = companion(artifact)
    gold = GoldRepository(artifact, silver)
    result = gold.gold_compare_shots(ShotScope(match_id=1, player_ids=[5503, 3009], exclude_penalties=True))
    assert result.endpoint_data_version == 1
    assert [s.event_id for s in result.shots] == ["messi-open", "messi-wide", "mbappe-open"]
    assert [(s.end_x, s.end_y) for s in result.shots] == [(120, 41.8), (120, 45.5), (120, 41.8)]
    assert [s.end_z for s in result.shots] == [.3, None, .3]
    assert result.evidence.shot_height_source.event_ids_with_height == ["messi-open", "mbappe-open"]
    assert result.evidence.shot_height_source.load_id == result.evidence.source_load_ids["base"]
    assert result.evidence.event_ids == [s.event_id for s in result.shots]
    assert sum(s.shots for s in result.summaries) == len(result.shots)


def test_absent_height_remains_unknown_and_horizontal_destinations_are_retained(gold):
    result = gold.gold_shots(ShotScope(match_id=1, player_ids=[5503]))
    assert all(s.end_z is None for s in result.shots)
    assert result.shots[0].end_x == 120
    assert result.evidence.shot_height_source is None


def test_changed_silver_height_file_is_rejected(artifact):
    silver = companion(artifact)
    with (silver / "shots.jsonl").open("a") as stream:
        stream.write("\n{}")
    with pytest.raises(GoldUnavailable): GoldRepository(artifact, silver)


def test_incompatible_silver_parent_is_rejected(artifact):
    silver = companion(artifact)
    path = silver / "manifest.json"
    manifest = json.loads(path.read_text())
    manifest["source_commit"] = "different-commit"
    path.write_text(json.dumps(manifest))
    with pytest.raises(GoldUnavailable): GoldRepository(artifact, silver)


def test_disagreeing_horizontal_endpoint_is_rejected(artifact):
    silver = companion(artifact)
    path = silver / "shots.jsonl"
    records = [json.loads(l) for l in path.read_text().splitlines()]
    records[0]["end_y"] = 99
    path.write_text("\n".join(json.dumps(r) for r in records))
    manifest_path = silver / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["files"]["shots.jsonl"] = hashlib.sha256(path.read_bytes()).hexdigest()
    manifest_path.write_text(json.dumps(manifest))
    gold_path = artifact / "manifest.json"
    manifest = json.loads(gold_path.read_text())
    manifest["source_manifest_hashes"]["base"] = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    gold_path.write_text(json.dumps(manifest))
    with pytest.raises(GoldUnavailable): GoldRepository(artifact, silver)


def test_old_snapshots_load_with_explicit_legacy_destination_version(client):
    cid = client.post("/api/conversations").json()["id"]
    result = client.post(f"/api/conversations/{cid}/turns", json=dict(message="Tiros de Messi en la final", base_turn_id=None)).json()["response"]
    del result["visualization"]["data"]["endpoint_data_version"]
    for shot in result["visualization"]["data"]["shots"]:
        for key in ("end_x", "end_y", "end_z"):
            del shot[key]
    restored = AgentResponse.model_validate(result)
    assert restored.visualization.data.endpoint_data_version == 0
    assert restored.visualization.data.shots[0].end_x is None


def legacy_response(response):
    result = copy.deepcopy(response)
    data = result["visualization"]["data"]
    data.pop("endpoint_data_version", None)
    for shot in data["shots"]:
        for key in ("end_x", "end_y", "end_z"):
            shot.pop(key, None)
    for evidence in (data["evidence"], result["evidence"]):
        evidence.pop("shot_height_source", None)
        evidence.pop("endpoint_definitions_sha256", None)
    return result


def test_historical_display_completes_only_coordinates_without_mutating_snapshot(artifact):
    from app.agent.graph import build_agent
    silver = companion(artifact)
    gold = GoldRepository(artifact, silver)
    current = build_agent(gold).invoke({"message": "Tiros de Messi en la final sin penales"})["response"].model_dump(mode="json")
    original = legacy_response(current)
    before = copy.deepcopy(original)
    displayed = gold.complete_destinations(original)
    assert original == before
    assert displayed["visualization"]["data"]["endpoint_data_version"] == 1
    assert displayed["visualization"]["data"]["shots"][0]["end_z"] == .3
    assert displayed["state"] == original["state"]
    assert displayed["applied_filters"] == original["applied_filters"]
    assert displayed["visualization"]["data"]["summaries"] == original["visualization"]["data"]["summaries"]
    assert displayed["evidence"]["query_definitions_sha256"] == original["evidence"]["query_definitions_sha256"]
    assert displayed["evidence"]["endpoint_definitions_sha256"] == gold.query_hash
    changed = copy.deepcopy(original)
    changed["visualization"]["data"]["evidence"]["gold_load_id"] = "other-load"
    assert gold.complete_destinations(changed) == changed
    changed = copy.deepcopy(original)
    changed["visualization"]["data"]["shots"][0]["xg"] = .999
    assert gold.complete_destinations(changed) == changed


def test_open_and_restore_old_history_automatically_include_destinations(client, gold, monkeypatch):
    import app.main as main
    from app.main import get_store
    monkeypatch.setattr(main, "get_gold", lambda: gold)
    store = main.app.dependency_overrides[get_store]()
    cid = client.post("/api/conversations").json()["id"]
    first = client.post(f"/api/conversations/{cid}/turns", json=dict(message="Tiros de Messi en la final sin penales", base_turn_id=None)).json()
    saved = legacy_response(first["response"])
    with store.connect() as db:
        db.execute("UPDATE turns SET response=? WHERE id=?", (json.dumps(saved), first["id"]))
    reopened = client.get(f"/api/conversations/{cid}").json()
    assert reopened["active_turn_id"] == first["id"]
    assert reopened["turns"][0]["response"]["visualization"]["data"]["shots"][0]["end_x"] == 120
    assert reopened["turns"][0]["response"]["visualization"]["data"]["endpoint_data_version"] == 1
    assert store.get(cid)["turns"][0]["response"] == saved
    restored = client.post(f"/api/conversations/{cid}/activate", json=dict(turn_id=first["id"], expected_active_turn_id=first["id"])).json()
    assert restored["turns"][0]["response"] == reopened["turns"][0]["response"]
