"""Versioned, JSON-serializable agent/UI contract."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ShotScope(StrictModel):
    match_id: int = Field(gt=0)
    player_ids: list[int] = Field(min_length=1, max_length=2)
    exclude_penalties: bool = False
    period: int | None = Field(default=None, ge=1, le=4)


class Shot(StrictModel):
    event_id: str
    match_id: int
    player_id: int
    player_name: str
    minute: int
    second: int
    period: int
    x: float | None
    y: float | None
    end_x: float | None = None
    end_y: float | None = None
    end_z: float | None = None
    xg: float | None
    outcome: str | None
    is_goal: bool
    is_penalty: bool
    quality_rule_ids: list[str]
    clock_reliable: bool


class Summary(StrictModel):
    player_id: int
    player_name: str
    shots: int
    goals: int
    xg: float | None
    missing_xg: int
    unlocated_shots: int


class HeightEvidence(StrictModel):
    source: Literal["silver.shots"] = "silver.shots"
    load_id: str
    manifest_sha256: str
    shots_sha256: str
    event_ids_with_height: list[str]


class Evidence(StrictModel):
    source: Literal["StatsBomb Open Data"] = "StatsBomb Open Data"
    gold_load_id: str
    gold_definitions_sha256: str
    query_definitions_sha256: str
    source_commit: str
    source_load_ids: dict[str, str]
    event_ids: list[str]
    source_url: str
    shot_height_source: HeightEvidence | None = None
    endpoint_definitions_sha256: str | None = None


class ShotDataset(StrictModel):
    endpoint_data_version: Literal[0, 1] = 0
    scope: ShotScope
    match_label: str
    shots: list[Shot]
    summaries: list[Summary]
    evidence: Evidence


class Visual(StrictModel):
    id: str
    type: Literal["shot_map", "shot_comparison"]
    title: str
    data: ShotDataset
    selected_event_id: str | None = None
    coordinate_system: Literal["statsbomb_120x80"] = "statsbomb_120x80"
    attack_direction: Literal["increasing_x"] = "increasing_x"


class ConversationState(StrictModel):
    scope: ShotScope | None = None
    metric: Literal["shots"] = "shots"
    active_visualization_id: str | None = None
    selected_event_id: str | None = None


class AgentResponse(StrictModel):
    contract_version: Literal["1.0"] = "1.0"
    status: Literal["result", "empty", "clarification"]
    explanation: str
    visualization_action: Literal["create", "update", "retain"]
    visualization: Visual | None
    state: ConversationState
    applied_filters: ShotScope | None
    evidence: Evidence | None
    tool_name: Literal["gold_shots", "gold_compare_shots"] | None


class TurnRequest(StrictModel):
    message: str = Field(min_length=1, max_length=2000)
    base_turn_id: str | None
    selected_event_id: str | None = None


class ActivateRequest(StrictModel):
    turn_id: str
    expected_active_turn_id: str | None


class TurnResponse(StrictModel):
    id: str
    conversation_id: str
    parent_turn_id: str | None
    message: str
    response: AgentResponse
    created_at: str


class ConversationResponse(StrictModel):
    id: str
    active_turn_id: str | None
    created_at: str
    turns: list[TurnResponse]
