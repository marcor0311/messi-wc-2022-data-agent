"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, ApiError, decimal, playerLabel, type Conversation, type Turn } from "@/lib/contracts";
import Pitch from "./pitch";
import GoalMouth from "./goal-mouth";
import { hasEndpoint } from "@/lib/shot-geometry";

const STORAGE_KEY = "wc2022.conversation.v1";
const FIRST_PROMPT = "Muéstrame los tiros de Messi en la final";
const OUTCOMES: Record<string, string> = { Goal: "Gol", Saved: "Atajado", "Off T": "Fuera", Blocked: "Bloqueado", Post: "Poste", Wayward: "Desviado", "Saved Off Target": "Atajado, fuera", "Saved to Post": "Atajado al poste" };

function ArrowIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>;
}

export default function AnalysisWorkspace() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const active = conversation?.turns.find(t => t.id === conversation.active_turn_id);
  const visual = active?.response.visualization;
  const shot = visual?.data.shots.find(s => s.event_id === selected);
  const busy = booting || pending !== null;
  const historical = !!active && active.id !== conversation?.turns.at(-1)?.id;

  async function load() {
    if (locked.current) return;
    locked.current = true; setBooting(true); setError(null);
    try {
      const id = localStorage.getItem(STORAGE_KEY);
      let value: Conversation;
      try { value = id ? await api<Conversation>(`/conversations/${id}`) : await api<Conversation>("/conversations", {}); }
      catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 422)) value = await api<Conversation>("/conversations", {});
        else throw e;
      }
      localStorage.setItem(STORAGE_KEY, value.id); setConversation(value); setStale(false);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo abrir la conversación."); }
    finally { setBooting(false); locked.current = false; }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [conversation?.turns.length, pending]);
  useEffect(() => { setSelected(active?.response.state.selected_event_id ?? null); }, [active?.id, active?.response.state.selected_event_id]);

  async function send(message: string) {
    if (!message.trim() || !conversation || locked.current || stale) return;
    locked.current = true; setPending(message); setError(null); setInput("");
    try {
      const turn = await api<Turn>(`/conversations/${conversation.id}/turns`, {
        message, base_turn_id: conversation.active_turn_id, selected_event_id: selected,
      });
      setConversation(c => c ? { ...c, active_turn_id: turn.id, turns: [...c.turns, turn] } : c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar. Intenta de nuevo."); setInput(message);
      // A lost HTTP response may follow a committed turn: reconcile before retrying.
      try {
        const recovered = await api<Conversation>(`/conversations/${conversation.id}`);
        setConversation(recovered);
        const saved = recovered.turns.find(t => t.id === recovered.active_turn_id);
        const committed = !(e instanceof ApiError && e.status === 409)
          && saved?.parent_turn_id === conversation.active_turn_id && saved?.message === message;
        if (committed) { setInput(""); setError("Se recuperó el estado guardado. Puedes continuar desde el resultado activo."); }
      } catch { setStale(true); }
    } finally { setPending(null); locked.current = false; }
  }

  async function activate(turn: Turn) {
    if (!conversation || locked.current || turn.id === active?.id) return;
    locked.current = true; setPending("Recuperando resultado…"); setError(null);
    try {
      setConversation(await api<Conversation>(`/conversations/${conversation.id}/activate`, {
        turn_id: turn.id, expected_active_turn_id: conversation.active_turn_id,
      }));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo recuperar el resultado."); setStale(true); }
    finally { setPending(null); locked.current = false; }
  }

  async function startNew() {
    if (locked.current) return;
    locked.current = true; setPending("Abriendo conversación…"); setError(null);
    try {
      const value = await api<Conversation>("/conversations", {});
      localStorage.setItem(STORAGE_KEY, value.id); setConversation(value); setInput(""); setSelected(null); setStale(false);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo iniciar la conversación."); }
    finally { setPending(null); locked.current = false; }
  }

  function submit(e: FormEvent) { e.preventDefault(); void send(input.trim()); }

  return <main className="app-shell">
    <header className="app-header">
      <div className="brand"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="3" y="3" width="22" height="22" rx="2" /><path d="M14 3v22M3 9h5v10H3m22-10h-5v10h5" /><circle cx="14" cy="14" r="4" /></svg><span>Messi<span className="brand-divider">/</span><span className="brand-subtitle">Mundial 2022</span></span></div>
      <Link className="header-note" href="/">Volver a la memoria albiceleste</Link>
      <button className="text-button" onClick={startNew} disabled={busy}>Nueva conversación</button>
    </header>
    <div className="workspace">
      <section className="conversation-panel" aria-labelledby="conversation-title">
        <div className="panel-header"><h1 id="conversation-title">Conversemos sobre el juego</h1><p>Pregunta, ajusta y compara.</p></div>
        <div className="messages" aria-busy={busy}>
          {!conversation?.turns.length ? <div className="welcome"><p>Empieza por un momento.</p><p>Los tiros de Messi en la final, por ejemplo. Después puedes quitar los penales o compararlo con Mbappé.</p><button className="prompt-button" disabled={busy || !conversation} onClick={() => send(FIRST_PROMPT)}>{FIRST_PROMPT}<span aria-hidden="true">↗</span></button></div> : null}
          {conversation?.turns.map((turn, index) => <article className={`turn ${turn.id === active?.id ? "active-turn" : ""}`} key={turn.id}>
            <p className="speaker">Tú</p><p className="user-message">{turn.message}</p>
            <p className="speaker agent-speaker">Análisis</p><p className="agent-message">{turn.response.explanation}</p>
            {turn.response.visualization ? <button className="result-button" aria-pressed={turn.id === active?.id} disabled={busy} onClick={() => activate(turn)}><span>{turn.response.visualization.type === "shot_comparison" ? "Comparación de tiros" : "Mapa de tiros"}<small>Resultado {index + 1} · {turn.response.applied_filters?.exclude_penalties ? "Sin penales" : "Con penales"}</small></span><span className="result-action">{turn.id === active?.id ? "Activo" : "Recuperar"}</span></button> : null}
          </article>)}
          {pending ? <div className="pending-message" role="status"><span className="pending-dot" />{pending.startsWith("Recuperando") || pending.startsWith("Abriendo") ? pending : "Consultando los eventos…"}</div> : null}
          <div ref={bottom} />
        </div>
        <div className="composer-area">
          {historical ? <p className="history-notice">Resultado anterior recuperado. Tu próxima petición continuará desde aquí.</p> : null}
          {error ? <div className="error-notice" role="alert"><p>{error}</p>{stale || !conversation ? <button onClick={load} disabled={busy}>Recargar conversación</button> : <button disabled={busy} onClick={() => input ? send(input) : load()}>Reintentar</button>}</div> : null}
          <form className="composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="message">Tu consulta de fútbol</label>
            <textarea id="message" placeholder={visual ? "Prueba: «Quita los penales»" : "¿Qué quieres explorar?"} value={input} rows={2} maxLength={2000} disabled={busy || !conversation || stale} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input.trim()); } }} />
            <button className="send-button" type="submit" aria-label="Enviar consulta" disabled={busy || !input.trim() || !conversation || stale}><ArrowIcon /></button>
          </form>
          <p className="composer-note">{booting ? "Abriendo tu conversación…" : "Primera versión · Tiros de la final · Messi y Mbappé"}</p>
        </div>
      </section>
      <section className="visual-panel" aria-labelledby="visual-title" aria-busy={pending !== null}>
        <div className="visual-topline"><span>Espacio de análisis</span><span>Final · 18 dic 2022</span></div>
        {visual ? <>
          <div className="visual-heading"><h2 id="visual-title">{visual.title}</h2><p>Argentina — Francia<span className="match-separator">·</span>Final del Mundial 2022</p></div>
          <div className="filter-row"><span className="filter-chip">Final</span><span className="filter-chip">{visual.data.scope.exclude_penalties ? "Sin penales" : "Con penales de partido"}</span><span className="filter-note">Tanda excluida</span>{pending ? <span className="updating" role="status">Actualizando…</span> : null}</div>
          {visual.data.endpoint_data_version !== 1 && visual.data.shots.length > 0 ? <div className="legacy-result"><p>Este resultado se guardó antes de incorporar los destinos.</p><button className="text-button" disabled={busy} onClick={() => send("Muéstrame los tiros")}>Actualizar con destinos y vista del arco</button></div> : null}
          <div className={`pitch-grid ${visual.type === "shot_comparison" ? "comparison" : ""}`}>
            {visual.data.summaries.map((summary, i) => <Pitch key={summary.player_id} allShots={visual.data.shots} playerName={summary.player_name} index={i} shots={visual.data.shots.filter(s => s.player_id === summary.player_id)} selected={selected} onSelect={setSelected} />)}
          </div>
          <div className="pitch-legend"><span><i className="legend-goal" />Gol</span><span><i className="legend-shot" />Otro resultado</span><span>Círculo: remate · Flecha: destino</span></div>
          <p className="chart-note">Los segmentos unen el origen y el final registrado del tiro. Selecciona un remate para resaltarlo en ambas vistas.</p>
          {visual.data.endpoint_data_version === 1 && visual.data.shots.some(s => !hasEndpoint(s)) ? <p className="data-note">{visual.data.shots.filter(s => !hasEndpoint(s)).length} tiros sin destino registrado. Se conserva su punto de remate.</p> : null}
          <section className="goal-section" aria-labelledby="goal-title">
            <div className="goal-heading"><h3 id="goal-title">Destino frente al arco</h3><p>Vista desde el rematador · Altura en escala StatsBomb</p></div>
            <div className={`pitch-grid goal-grid-layout ${visual.type === "shot_comparison" ? "comparison" : ""}`}>
              {visual.data.summaries.map((summary, i) => <GoalMouth key={summary.player_id} allShots={visual.data.shots} playerName={summary.player_name} index={i} shots={visual.data.shots.filter(s => s.player_id === summary.player_id)} selected={selected} onSelect={setSelected} />)}
            </div>
            <p className="chart-note goal-note"><span className="legend-diamond" aria-hidden="true" />Rombo: tiro detenido antes de la línea de gol. Se muestra su posición final, sin prolongarlo hasta el arco.</p>
          </section>
          {!visual.data.shots.length ? <div className="empty-result" role="status"><h3>No hay tiros con estos filtros</h3><p>Prueba «incluye los penales» o elige otro jugador. Puedes recuperar un resultado del historial.</p></div> : null}
          <table className="summary-table"><caption className="sr-only">Resumen de los mismos eventos representados en la cancha</caption><thead><tr><th scope="col">Jugador</th><th scope="col">Tiros</th><th scope="col">Goles</th><th scope="col"><abbr title="Goles esperados según el modelo de StatsBomb">xG</abbr></th></tr></thead><tbody>{visual.data.summaries.map((summary, i) => <tr key={summary.player_id}><th scope="row"><span className={`table-player player-${i}`} />{playerLabel(summary.player_name)}</th><td>{summary.shots}</td><td>{summary.goals}</td><td>{decimal(summary.xg)}</td></tr>)}</tbody></table>
          {visual.data.summaries.some(s => s.unlocated_shots || s.missing_xg) ? <p className="data-note">{visual.data.summaries.map(s => `${playerLabel(s.player_name)}: ${s.unlocated_shots} tiros sin ubicación; ${s.missing_xg} sin xG`).join(". ")}. Los tiros sin ubicación cuentan en el resumen y no se dibujan.</p> : null}
          {shot ? <div className="shot-detail" aria-live="polite"><div className="shot-detail-heading"><h3>{playerLabel(shot.player_name)} · {shot.minute}:{String(shot.second).padStart(2, "0")}</h3><button className="text-button" onClick={() => setSelected(null)}>Cerrar detalle</button></div><p>{OUTCOMES[shot.outcome ?? ""] ?? shot.outcome ?? "Resultado desconocido"} · {decimal(shot.xg, 3)} xG · Período {shot.period}{shot.is_penalty ? " · Penal" : ""}</p><p className="data-note">Origen: {shot.x ?? "no disponible"}, {shot.y ?? "no disponible"} · Destino: {shot.end_x ?? "no disponible"}, {shot.end_y ?? "no disponible"} · Altura final: {shot.end_z ?? "no registrada"} · Escala StatsBomb{!shot.clock_reliable ? " · Reloj señalado por calidad" : ""}</p><p className="event-id">{shot.event_id}</p>{shot.quality_rule_ids.length ? <p className="data-note">Observaciones de calidad: {shot.quality_rule_ids.join(", ")}</p> : null}<button className="text-button detail-question" disabled={busy} onClick={() => send("Explícame ese tiro")}>Consultar este tiro en la conversación</button></div> : null}
          <details className="event-details"><summary>Explorar los {visual.data.shots.length} eventos</summary><div className="event-list">{visual.data.shots.map(s => <button key={s.event_id} aria-pressed={s.event_id === selected} onClick={() => setSelected(s.event_id)}><span>{playerLabel(s.player_name)}</span><span>{s.minute}:{String(s.second).padStart(2, "0")}</span><span>{OUTCOMES[s.outcome ?? ""] ?? s.outcome}</span><span>{decimal(s.xg)} xG</span></button>)}</div></details>
          <details className="evidence"><summary>Fuente y evidencia<span>StatsBomb Open Data</span></summary><p>Las cifras y ambas vistas parten de los mismos {visual.data.shots.length} eventos. Se incluyen los períodos 1–4 y se excluye la tanda. La altura procede de Silver, verificado contra el padre de Gold; no se estima cuando falta.</p><a href={visual.data.evidence.source_url} target="_blank" rel="noreferrer">Ver eventos originales de este partido ↗</a><dl><dt>Gold</dt><dd>{visual.data.evidence.gold_load_id}</dd><dt>Definiciones Gold</dt><dd>{visual.data.evidence.gold_definitions_sha256}</dd><dt>Consulta</dt><dd>{visual.data.evidence.query_definitions_sha256}</dd><dt>Commit de origen</dt><dd>{visual.data.evidence.source_commit}</dd>{visual.data.evidence.shot_height_source ? <><dt>Silver · altura de los tiros</dt><dd>{visual.data.evidence.shot_height_source.load_id}</dd><dt>Checksum de alturas</dt><dd>{visual.data.evidence.shot_height_source.shots_sha256}</dd></> : null}<dt>Eventos seleccionados</dt><dd>{visual.data.evidence.event_ids.join("\n") || "Ninguno"}</dd></dl><p>xG describe la probabilidad estimada de gol de cada tiro; no mide toda la actuación de un jugador. Los segmentos no reconstruyen la curva del balón. Los puntos frontales son posiciones finales observadas; las atajadas anteriores a la línea no representan un cruce del arco.</p></details>
          <p className="source-credit">Datos: StatsBomb Open Data · <a href="https://github.com/statsbomb/open-data" target="_blank" rel="noreferrer">Fuente</a></p>
        </> : <div className="visual-empty"><h2 id="visual-title">El juego, a la vista.</h2><p>Tu primera pregunta abre la cancha.<br />Las siguientes le dan contexto.</p><div className="empty-pitch" aria-hidden="true"><svg viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth=".4"><rect x="1" y="1" width="118" height="78" /><path d="M60 1v78M1 18h17v44H1m118-44h-17v44h17" /><circle cx="60" cy="40" r="9.15" /></svg></div><p className="empty-guidance">Tiros → Sin penales → Comparación</p></div>}
      </section>
    </div>
  </main>;
}
