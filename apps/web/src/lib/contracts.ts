/** API contract 1.0. Snapshots and context are owned by the server. */
export type ShotScope = { match_id: number; player_ids: number[]; exclude_penalties: boolean; period: number | null };
export type Shot = {
  event_id: string; match_id: number; player_id: number; player_name: string;
  minute: number; second: number; period: number; x: number | null; y: number | null;
  end_x: number | null; end_y: number | null; end_z: number | null;
  xg: number | null; outcome: string | null; is_goal: boolean; is_penalty: boolean;
  quality_rule_ids: string[]; clock_reliable: boolean;
};
export type Summary = {
  player_id: number; player_name: string; shots: number; goals: number;
  xg: number | null; missing_xg: number; unlocated_shots: number;
};
export type Evidence = {
  source: string; gold_load_id: string; gold_definitions_sha256: string;
  query_definitions_sha256: string; source_commit: string; source_load_ids: Record<string, string>;
  event_ids: string[]; source_url: string;
  shot_height_source?: { source: "silver.shots"; load_id: string; manifest_sha256: string; shots_sha256: string; event_ids_with_height: string[] } | null;
  endpoint_definitions_sha256?: string | null;
};
export type Visual = {
  id: string; type: "shot_map" | "shot_comparison"; title: string;
  coordinate_system: "statsbomb_120x80"; attack_direction: "increasing_x";
  selected_event_id: string | null;
  data: { endpoint_data_version?: 0 | 1; scope: ShotScope; match_label: string; shots: Shot[]; summaries: Summary[]; evidence: Evidence };
};
export type AgentResponse = {
  contract_version: "1.0"; status: "result" | "empty" | "clarification";
  explanation: string; visualization_action: "create" | "update" | "retain";
  visualization: Visual | null; applied_filters: ShotScope | null; evidence: Evidence | null;
  state: { scope: ShotScope | null; metric: "shots"; active_visualization_id: string | null; selected_event_id: string | null };
  tool_name: "gold_shots" | "gold_compare_shots" | null;
};
export type Turn = { id: string; parent_turn_id: string | null; message: string; response: AgentResponse; created_at: string };
export type Conversation = { id: string; active_turn_id: string | null; created_at: string; turns: Turn[] };

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45000), cache: "no-store",
    });
  } catch {
    throw new ApiError("No se pudo conectar con el agente. Revisa que la API esté iniciada y vuelve a intentar.", 0);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(typeof result?.detail === "string" ? result.detail : "No se pudo completar la consulta. Vuelve a intentar.", response.status);
  return result as T;
}

export const playerLabel = (name: string) => name.includes("Messi") ? "Lionel Messi" : name.includes("Mbappé") ? "Kylian Mbappé" : name;
export const decimal = (value: number | null, digits = 2) => value === null ? "—" : value.toLocaleString("es", { minimumFractionDigits: digits, maximumFractionDigits: digits });
