"""Read-only tools over the existing immutable Gold JSONL contract.

No dependency on local, gitignored ETL scripts. Counts and coordinates always
come from the very same selected events, including unlocated shots explicitly.
"""
import hashlib
import json
import math
import os
from pathlib import Path

from app.agent.models import AgentResponse, Evidence, HeightEvidence, Shot, ShotDataset, ShotScope, Summary

ROOT = Path(__file__).resolve().parents[5]


class GoldUnavailable(RuntimeError):
    pass


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


class GoldRepository:
    def __init__(self, folder: Path | None = None, silver_folder: Path | None = None):
        configured = os.environ.get("GOLD_ARTIFACT")
        if folder is None and configured:
            folder = Path(configured).expanduser().resolve()
        if folder is None:
            candidates = list((ROOT / "data/gold/statsbomb/wc2022").glob("v1-*/manifest.json"))
            if not candidates:
                raise GoldUnavailable("No se encontró Gold. Configura GOLD_ARTIFACT con un artefacto validado.")
            folder = max(candidates, key=lambda p: (p.stat().st_mtime_ns, str(p))).parent
        self.folder = folder
        try:
            self.manifest = json.loads((folder / "manifest.json").read_text())
            if self.manifest["gold_version"] != 1 or self.manifest["dataset"] != "statsbomb-wc2022-gold":
                raise ValueError("Contrato Gold incompatible")
            required = {"actions.jsonl", "player_match.jsonl", "team_match.jsonl"}
            if not required <= self.manifest["files"].keys():
                raise ValueError("Inventario Gold incompleto")
            for name, checksum in self.manifest["files"].items():
                if Path(name).name != name or digest(folder / name) != checksum:
                    raise ValueError(f"Integridad Gold incorrecta: {name}")
            self.players = {r["player_id"]: r["player_name"] for r in self.rows("player_match")}
            self.matches = {}
            for row in self.rows("team_match"):
                self.matches.setdefault(row["match_id"], row)
            finals = [m["match_id"] for m in self.matches.values() if m["stage_name"] == "Final"]
            if len(finals) != 1:
                raise ValueError("La final no es unívoca")
            self.final_id = finals[0]
            self.heights, self.height_source = self.read_heights(silver_folder)
            # Index only shots, not the entire 177 MB action table.
            self.shots = [self.to_shot(r) for r in self.rows("actions")
                          if r["type_name"] == "Shot" and r["period"] in (1, 2, 3, 4)]
            # Reject an artifact changed while it was being read.
            for name in required:
                if digest(folder / name) != self.manifest["files"][name]:
                    raise ValueError("Gold cambió durante la lectura")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise GoldUnavailable("No se pudo verificar el artefacto Gold.") from exc
        self.query_hash = digest(Path(__file__))

    def rows(self, name):
        with (self.folder / f"{name}.jsonl").open() as stream:
            for line in stream:
                yield json.loads(line)

    def read_heights(self, folder):
        """Join only the Silver snapshot pinned by this Gold's manifest.

        Gold v1 already carries horizontal endpoints. Its parent Silver retains
        shot height; reading that verified companion avoids rewriting Gold v1.
        An absent companion means unknown heights, never zero or an estimate.
        """
        configured = os.environ.get("SHOT_HEIGHT_ARTIFACT")
        if folder is None and configured:
            folder = Path(configured).expanduser().resolve()
        expected = self.manifest.get("source_manifest_hashes", {}).get("base")
        if folder is None and expected:
            candidates = (ROOT / "data/silver/statsbomb/wc2022").glob("v1-*/manifest.json")
            folder = next((p.parent for p in candidates if digest(p) == expected), None)
        if folder is None:
            return {}, None
        manifest_path = folder / "manifest.json"
        if not expected or digest(manifest_path) != expected:
            raise ValueError("La altura no corresponde al padre Silver de Gold")
        manifest = json.loads(manifest_path.read_text())
        if (manifest["load_id"] != self.manifest["source_load_ids"]["base"]
                or manifest["source_commit"] != self.manifest["source_commit"]):
            raise ValueError("Procedencia incompatible para altura de tiro")
        path = folder / "shots.jsonl"
        checksum = manifest["files"]["shots.jsonl"]
        if digest(path) != checksum:
            raise ValueError("Integridad Silver incorrecta: shots.jsonl")
        heights = {}
        with path.open() as stream:
            for line in stream:
                row = json.loads(line)
                key = (row["match_id"], row["event_id"])
                if key in heights:
                    raise ValueError("Destino de tiro duplicado")
                heights[key] = row
        if digest(path) != checksum or digest(manifest_path) != expected:
            raise ValueError("Silver cambió durante la lectura")
        return heights, dict(load_id=manifest["load_id"], manifest_sha256=expected, shots_sha256=checksum)

    def to_shot(self, row):
        x, y = row["location_x"], row["location_y"]
        if x is None or y is None or not (math.isfinite(x) and math.isfinite(y) and 0 <= x <= 120 and 0 <= y <= 80):
            x = y = None
        end_x, end_y = row.get("end_x"), row.get("end_y")
        if end_x is None or end_y is None or not (math.isfinite(end_x) and math.isfinite(end_y)):
            end_x = end_y = None
        height = self.heights.get((row["match_id"], row["event_id"]))
        if height and (height["end_x"] != row.get("end_x") or height["end_y"] != row.get("end_y")):
            raise ValueError("El destino Silver difiere de Gold")
        end_z = height.get("end_z") if height else row.get("end_z")
        if end_z is not None and (not math.isfinite(end_z) or end_z < 0):
            end_z = None
        return Shot(event_id=row["event_id"], match_id=row["match_id"], player_id=row["player_id"],
                    player_name=self.players[row["player_id"]], minute=row["minute"], second=row["second"],
                    period=row["period"], x=x, y=y, end_x=end_x, end_y=end_y, end_z=end_z,
                    xg=row["statsbomb_xg"], outcome=row["outcome_name"],
                    is_goal=row["is_goal"], is_penalty=row["is_penalty"],
                    quality_rule_ids=row["quality_rule_ids"], clock_reliable=row["clock_reliable"])

    def select(self, scope: ShotScope) -> ShotDataset:
        if scope.match_id not in self.matches:
            raise ValueError("Partido desconocido")
        if len(set(scope.player_ids)) != len(scope.player_ids) or not set(scope.player_ids) <= self.players.keys():
            raise ValueError("Indica jugadores conocidos y distintos")
        selected = [s for s in self.shots if s.match_id == scope.match_id and s.player_id in scope.player_ids
                    and (not scope.exclude_penalties or not s.is_penalty)
                    and (scope.period is None or s.period == scope.period)]
        summaries = []
        for pid in scope.player_ids:
            group = [s for s in selected if s.player_id == pid]
            missing = sum(s.xg is None for s in group)
            summaries.append(Summary(player_id=pid, player_name=self.players[pid], shots=len(group),
                                     goals=sum(s.is_goal for s in group),
                                     xg=None if missing else math.fsum(s.xg for s in group),
                                     missing_xg=missing, unlocated_shots=sum(s.x is None for s in group)))
        m = self.matches[scope.match_id]
        height_evidence = HeightEvidence(**self.height_source, event_ids_with_height=[s.event_id for s in selected if s.end_z is not None]) if self.height_source else None
        evidence = Evidence(gold_load_id=self.manifest["load_id"], shot_height_source=height_evidence,
                            gold_definitions_sha256=self.manifest["definitions_sha256"],
                            query_definitions_sha256=self.query_hash, source_commit=self.manifest["source_commit"],
                            source_load_ids=self.manifest["source_load_ids"], event_ids=[s.event_id for s in selected],
                            source_url=f"https://github.com/statsbomb/open-data/blob/{self.manifest['source_commit']}/data/events/{scope.match_id}.json")
        return ShotDataset(endpoint_data_version=1, scope=scope, match_label=f"{m['team_name']} · {m['opponent_name']} · {m['match_date']}",
                           shots=selected, summaries=summaries, evidence=evidence)

    def gold_shots(self, scope: ShotScope) -> ShotDataset:
        if len(scope.player_ids) != 1:
            raise ValueError("Tiros requiere un jugador")
        return self.select(scope)

    def gold_compare_shots(self, scope: ShotScope) -> ShotDataset:
        if len(scope.player_ids) != 2:
            raise ValueError("La comparación requiere dos jugadores")
        return self.select(scope)

    def complete_destinations(self, response: dict) -> dict:
        """Complete the display of an old snapshot, without rewriting history.

        Only the same Gold load and exactly the same recorded selection may
        supply coordinates. Original metrics, filters, IDs and query provenance
        remain untouched; the enrichment carries its own definition hash.
        """
        saved = AgentResponse.model_validate(response)
        visual = saved.visualization
        if visual is None or visual.data.endpoint_data_version == 1:
            return response
        evidence = visual.data.evidence
        if (evidence.gold_load_id != self.manifest["load_id"]
                or evidence.source_commit != self.manifest["source_commit"]):
            return response
        current = self.select(visual.data.scope)
        if ([s.event_id for s in visual.data.shots] != current.evidence.event_ids
                or evidence.event_ids != current.evidence.event_ids
                or visual.data.summaries != current.summaries):
            return response
        excluded = {"end_x", "end_y", "end_z"}
        for old, new in zip(visual.data.shots, current.shots):
            if old.model_dump(exclude=excluded) != new.model_dump(exclude=excluded):
                return response
        enriched = saved.model_copy(deep=True)
        data = enriched.visualization.data
        for old, new in zip(data.shots, current.shots):
            old.end_x, old.end_y, old.end_z = new.end_x, new.end_y, new.end_z
        data.endpoint_data_version = 1
        data.evidence.shot_height_source = current.evidence.shot_height_source
        data.evidence.endpoint_definitions_sha256 = self.query_hash
        if enriched.evidence:
            enriched.evidence.shot_height_source = current.evidence.shot_height_source
            enriched.evidence.endpoint_definitions_sha256 = self.query_hash
        return enriched.model_dump(mode="json")
