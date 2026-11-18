'use client';
import { flushSync } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { focusPlayer, playerName } from '../agent-visual';
import Composer from './composer';
import { PlusIcon, ViewIcon } from './icons';
import { AgentMessage, UserMessage } from './message';
import { ResultView, dashboardGroups, defaultResult, resultTitle } from './result-panel';
import EvidenceBall from './evidence-ball';
import { ApiError, api, type Catalog, type Model, type Session, type Turn } from './types';

/* Keep the conversation history stable across the route change. */
const CONVERSATION_KEY = 'football-agent-conversation';
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable: preference lasts for this visit */ } },
  remove: (k: string) => { try { localStorage.removeItem(k); } catch { /* idem */ } },
};

type Active = { turn: number; result: number };
type Failure = { message: string; status: number };

export default function AgentWorkspace() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [accounts, setAccounts] = useState<{ account_id: string; label: string }[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [cid, setCid] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [unseen, setUnseen] = useState<number | null>(null);
  const [moreIdeas, setMoreIdeas] = useState(false);
  const [explorer, setExplorerState] = useState(false);
  /* Both views share one route: the hash keeps Back/Forward working and the
     View Transitions API morphs pane + tab underline between states. */
  const setExplorer = useCallback((next: boolean, fromHistory = false) => {
    if (!fromHistory) {
      const url = next ? '#ap-explorer' : location.pathname + location.search;
      if ((location.hash === '#ap-explorer') !== next) history.pushState(null, '', url);
    }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduced) { setExplorerState(next); return; }
    doc.startViewTransition(() => flushSync(() => setExplorerState(next)));
  }, []);
  useEffect(() => {
    const sync = () => setExplorer(location.hash === '#ap-explorer', true);
    if (location.hash === '#ap-explorer') setExplorerState(true);
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, [setExplorer]);
  const [announce, setAnnounce] = useState('');
  const [reflow, setReflow] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);

  // Enlarged text keeps a readable vertical document instead of a clipped two-pane layout.
  useEffect(() => {
    const check = () => setReflow(parseFloat(getComputedStyle(document.documentElement).fontSize) > 20);
    check(); addEventListener('resize', check);
    return () => removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    let alive = true;
    api<Catalog>('agent/catalog').then(c => alive && setCatalog(c)).catch(e => alive && setCatalogError((e as Error).message));
    api<{ account_id: string; label: string }[]>('auth/accounts').then(a => alive && setAccounts(a)).catch(() => {});
    api<Session>('auth/status').then(s => {
      if (!alive) return;
      setSession(s);
      if (!s.authenticated) return;
      api<{ models: Model[]; selected: string }>('agent/models').then(m => { if (alive) { setModels(m.models); setModel(m.selected); } })
        .catch(e => alive && setFailure({ message: (e as Error).message, status: (e as ApiError).status ?? 0 }));
      const saved = store.get(CONVERSATION_KEY);
      if (!saved) return;
      setRestoring(true);
      api<{ conversation_id: string; turns: Turn[] }>('agent/conversations/' + saved).then(h => {
        if (!alive) return;
        setCid(h.conversation_id); setTurns(h.turns); store.set(CONVERSATION_KEY, h.conversation_id);
        if (h.turns.length) { const last = h.turns.length - 1; setActive({ turn: last, result: defaultResult(h.turns[last]) }); }
      }).catch(() => store.remove(CONVERSATION_KEY)).finally(() => alive && setRestoring(false));
    }).catch(e => alive && setSession({ authenticated: false, detail: (e as Error).message }));
    return () => { alive = false; };
  }, []);

  // Keep the log pinned to the newest message only when the reader is already at the end.
  const nearEnd = () => { const el = log.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
  const stick = useRef(true);
  useLayoutEffect(() => { const el = log.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [turns.length, pending, failure]);

  followLatest.current = active === null || active.turn === turns.length - 1;
  const turnCount = useRef(0);
  turnCount.current = turns.length;

  const open = useCallback((turn: number, result: number, origin?: string) => {
    setActive({ turn, result });
    if (unseen !== null && turn >= unseen) setUnseen(null);
    const t = turns[turn]?.visualizations[result];
    if (t && origin) setAnnounce(`Mostrando ${resultTitle(t, catalog)}, de la respuesta ${turn + 1}.`);
    if (origin) requestAnimationFrame(() => document.getElementById(`ap-result-${turn}-${result}`)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  }, [turns, unseen, catalog]);

  async function send() {
    const question = draft.trim();
    if (!question || pending || !session?.authenticated) return;
    stick.current = true;
    setPending(question); setFailure(null); setDraft('');
    try {
      const r = await api<{ conversation_id: string; turn: Turn }>('agent/chat', { question, conversation_id: cid, model: model || undefined });
      setCid(r.conversation_id); store.set(CONVERSATION_KEY, r.conversation_id);
      const index = turnCount.current;
      setTurns(prev => [...prev, r.turn]);
      // The new answer always opens: earlier ones stay one tap away on their question bubble.
      setActive({ turn: index, result: defaultResult(r.turn) });
      setAnnounce(`Respuesta recibida con ${r.turn.visualizations.length} ${r.turn.visualizations.length === 1 ? 'resultado' : 'resultados'}.`);
    } catch (e) {
      setFailure({ message: (e as Error).message, status: (e as ApiError).status ?? 0 });
      // The question comes back for a retry, unless something new was typed while waiting.
      setDraft(d => (d.trim() ? d : question));
    } finally {
      setPending(null);
    }
  }

  function newConversation() {
    setTurns([]); setCid(null); setActive(null); setUnseen(null); setFailure(null);
    store.remove(CONVERSATION_KEY);
    document.getElementById('ap-question')?.focus();
  }

  async function logout() {
    try { await api('auth/logout', {}); } catch { /* the session is cleared locally either way */ }
    setSession({ authenticated: false }); setModels([]); setModel(''); newConversation();
  }

  const focus = catalog ? focusPlayer(catalog.entities) : undefined;
  const surname = focus && catalog ? playerName(focus.player_id, catalog.entities).split(' ').slice(-1)[0] : 'Messi';
  const ideas = [
    `¿Desde dónde remató ${surname} en el Mundial? Muéstralo en la cancha.`,
    `Compara a ${surname} y Mbappé en la final.`,
    `¿Cómo cambió el peligro que generó ${surname} partido a partido?`,
    `¿Con qué compañeros se buscó más ${surname} en la final?`,
    `¿En qué zonas de la cancha recibió más la pelota ${surname}?`,
    'Muéstrame los dos onces de la final.',
  ];
  const authenticated = !!session?.authenticated;
  const activeTurn = active ? turns[active.turn] : undefined;
  const activeResult = active && activeTurn ? activeTurn.visualizations[active.result] : undefined;
  const latest = turns.length - 1;
  const sessionExpired = failure?.status === 401;

  return <div className={'ap' + (reflow ? ' ap-reflow' : '')}>
    <a className="ap-skip" href="#ap-question">Ir a la pregunta</a>
    <header className="ap-top">
      <a href="/" className="ap-brand">Memoria <span>/ Lab</span></a>
      <nav aria-label="Secciones del laboratorio" className="ap-nav">
        <a aria-current={explorer ? undefined : 'page'} href="/agent" onClick={e => { e.preventDefault(); setExplorer(false); }}>Conversación</a>
        <a aria-current={explorer ? 'page' : undefined} href="#ap-explorer" onClick={e => { e.preventDefault(); setExplorer(true); }}>Explorar datos</a>
      </nav>
      <div className="ap-account">
        {session === null ? null : authenticated
          ? <><button type="button" className="ap-text-button" onClick={logout} disabled={!!pending}>Cerrar sesión</button></>
          : <a className="ap-primary-link" href="/api/auth/start">Continue with ChatGPT</a>}
      </div>
    </header>

    <main className="ap-body">
      {explorer ? <section id="ap-explorer" className="ap-chat" aria-labelledby="ap-chat-title">
        <div className="ap-chat-head"><h1 id="ap-chat-title">Explorar datos</h1><button type="button" className="ap-text-button" onClick={() => setExplorer(false)}>Volver a conversación</button></div>
        <div className="ap-log">
          <h2>Explora el Mundial 2022</h2>
          <p>Consulta los datos públicos por selección, partido o jugador.</p>
          {catalog ? <div className="ap-views" aria-label="Tipos de resultado disponibles">{Object.entries(catalog.views).map(([k, v]) => <div key={k}><ViewIcon view={k} /><span><strong>{v.label}</strong>{v.description}</span></div>)}</div> : <p role="status">{catalogError || 'Cargando el catálogo de datos…'}</p>}
        </div>
      </section> : <section className="ap-chat" aria-labelledby="ap-chat-title">
        <div className="ap-chat-head">
          <h1 id="ap-chat-title">Conversación</h1>
          {turns.length ? <button type="button" className="ap-text-button" onClick={newConversation} disabled={!!pending}><PlusIcon />Nueva conversación</button> : null}
        </div>

        <div className="ap-log" ref={log} role="log" aria-label="Mensajes" onScroll={() => { stick.current = nearEnd(); }}>
          {restoring ? <p className="ap-meta" role="status">Recuperando la conversación…</p> : null}
          {!turns.length && !pending && !restoring ? <div className="ap-welcome">
            <h2>{authenticated || session === null ? `¿Qué quieres saber del Mundial de ${surname}?` : 'Conecta tu cuenta para conversar'}</h2>
            <p>{authenticated || session === null
              ? 'El agente consulta los datos de StatsBomb del Mundial 2022, elige el gráfico y te explica la respuesta a tu nivel.'
              : 'La conversación usa el modelo de tu cuenta. Sin iniciar sesión puedes recorrer los datos en el explorador público.'}</p>
            {session && !authenticated ? <div className="ap-welcome-actions">
              <a className="ap-primary-link" href="/api/auth/start">Continue with ChatGPT</a>
              {accounts.map(a => <a key={a.account_id} className="ap-text-link" href={'/api/auth/start?account_id=' + a.account_id}>Continuar: {a.label}</a>)}
            </div> : null}
            <p className="ap-ideas-title" id="ap-ideas">Para empezar</p>
            <ul className="ap-ideas" aria-labelledby="ap-ideas">
              {(moreIdeas ? ideas : ideas.slice(0, 3)).map(s => <li key={s}><button type="button" onClick={() => { setDraft(s); document.getElementById('ap-question')?.focus(); }}>{s}</button></li>)}
            </ul>
            <button type="button" className="ap-text-button" aria-expanded={moreIdeas} onClick={() => setMoreIdeas(v => !v)}>{moreIdeas ? 'Menos ideas' : 'Más ideas'}</button>
          </div> : null}

          {turns.map((t, i) => <AgentMessage key={i} turn={t} index={i} catalog={catalog} activeResult={active?.turn === i ? active.result : null} onOpen={r => open(i, r, 'chat')} />)}

          {pending ? <div className="ap-turn ap-pending">
            <UserMessage text={pending} />
            <p className="ap-working" role="status"><span aria-hidden="true" className="ap-pulse" />Consultando los datos…</p>
          </div> : null}

          {failure ? <div className="ap-error" role="alert">
            <p>{sessionExpired ? 'Tu sesión venció. Vuelve a conectar tu cuenta; tu pregunta sigue en el campo.' : failure.message}</p>
            {sessionExpired ? <a className="ap-text-link" href="/api/auth/start">Conectar de nuevo</a>
              : <p className="ap-meta">Tu pregunta sigue en el campo para reintentarla. Las respuestas anteriores no cambiaron.</p>}
          </div> : null}
        </div>

        <Composer value={draft} onChange={setDraft} onSubmit={send}
          models={models} model={model} onModel={setModel}
          canSend={authenticated && !pending && !!draft.trim()} pending={!!pending} authenticated={authenticated} />
      </section>}

      <section className="ap-panel" aria-label="Resultados">
        <h2 className="ap-sr">Resultados</h2>
        <p className="ap-sr" role="status">{announce}</p>
        {pending ? <div className="ap-loading" role="status" aria-label="Consultando los datos">
          <div className="ap-skeleton-line" /><div className="ap-skeleton-line ap-short" /><div className="ap-skeleton-pitch" />
        </div> : activeTurn && active ? <>
          {activeTurn.visualizations.length && catalog ? <div id="ap-result" className="ap-result ap-dashboard">
            {dashboardGroups(activeTurn).map((group, g) => {
              const items = group.map(({ v, i }) => <section key={`${active.turn}-${i}`} id={`ap-result-${active.turn}-${i}`} className="ap-dash-item">
                <ResultView result={v} catalog={catalog} headingId={g === 0 && i === group[0].i ? 'ap-result-title' : `ap-result-title-${i}`} showTitle={activeTurn.visualizations.length > 1} />
              </section>);
              return group.length > 1 ? <div key={g} className="ap-dash-pair">{items}</div> : items[0];
            })}
          </div> : <div className="ap-intro"><h2>Esta respuesta no trae resultados de datos</h2><p>La explicación está en la conversación. Pide un gráfico o una cifra para ver aquí su evidencia.</p></div>}
        </> : <div className="ap-intro ap-intro-ball">
          <h2 className="ap-sr">Aquí verás la evidencia de cada respuesta</h2>
          <EvidenceBall />
          {catalogError ? <p className="ap-error" role="alert">{catalogError}</p> : null}
        </div>}
      </section>
    </main>
  </div>;
}
