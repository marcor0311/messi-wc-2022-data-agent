"""Small deterministic LangGraph agent for the first supported conversation.

Intents are deliberately bounded; unsupported requests ask for clarification.
The graph and typed tools can later be driven by a model without changing the UI.
"""
import re
import unicodedata
from typing import TypedDict
from uuid import uuid4

from langgraph.graph import END, START, StateGraph

from app.agent.models import AgentResponse, ConversationState, ShotScope, Visual
from app.db.gold import GoldRepository


def normalize(message: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", message.lower()) if unicodedata.category(c) != "Mn")


class Work(TypedDict, total=False):
    message: str
    previous: AgentResponse | None
    selected_event_id: str | None
    state: ConversationState
    clarification: str
    detail: bool
    dataset: object
    tool_name: str
    response: AgentResponse


def build_agent(gold: GoldRepository):
    def resolve(work: Work):
        previous = work.get("previous")
        state = previous.state.model_copy(deep=True) if previous else ConversationState()
        message = normalize(work["message"])
        def clarify(text):
            return {"state": state, "clarification": text}

        # Never silently answer a different metric, match, or unsupported filter.
        if re.search(r"\b(pases?|recepciones?|creacion|asistencias?|alineaciones?|semifinal\w*|croacia|cuartos|torneo|mundial completo|todos los partidos|presion|juego abierto|segundo tiempo|primer tiempo)\b", message):
            return clarify("En esta primera versión puedo mostrar tiros en la final, quitar o incluir penales y comparar a Messi con Mbappé. Reformula la consulta con ese alcance.")
        if re.search(r"\b(ese|este|el) tiro\b", message):
            selected = work.get("selected_event_id") or state.selected_event_id
            valid = previous and previous.visualization and any(s.event_id == selected for s in previous.visualization.data.shots)
            if not valid:
                return clarify("Selecciona un tiro en la cancha y escribe «ese tiro» para consultar su detalle.")
            state.selected_event_id = selected
            return {"state": state, "detail": True}

        vocabulary = set("muestrame muestra muestran mostrar mostrarme ensename ensena dame ver quiero puedes puede los las el la de del en final tiros tiro remates remate messi lionel andres cuccittini mbappe kylian lottin sin quita quitar quitame quitalos excluye excluir excluyelos elimina eliminar penales penal penalti penaltis incluye incluir incluyelos agrega agregar con comparalo comparalos compara comparar comparame comparacion versus vs y a al por favor ahora tambien otra vez vuelve todo todos".split())
        if any(token not in vocabulary for token in re.findall(r"\w+", message)):
            return clarify("No puedo aplicar esa condición todavía. Prueba tiros de Messi o Mbappé en la final, quitar o incluir penales, o comparar ambos jugadores.")

        ids = []
        for mention in re.finditer(r"\b(messi|mbappe)\b", message):
            alias = mention.group(1)
            if not any(alias in normalize(gold.players[pid]) for pid in ids):
                matches = [pid for pid, name in gold.players.items() if alias in normalize(name)]
                if len(matches) != 1:
                    return clarify(f"No puedo identificar a {alias} en este Gold.")
                ids.append(matches[0])
        compare = bool(re.search(r"\b(compar\w*|versus|vs)\b", message))
        penalty_phrase = r"\s+(?:por favor\s+)?(?:todos\s+)?(?:los\s+)?(?:tiros\s+de\s+)?penal\w*\b"
        exclude = bool(re.search(r"\b(sin|quita\w*|exclu\w*|elimina\w*)" + penalty_phrase, message))
        include = bool(re.search(r"\b(inclu\w*|agrega\w*|con)" + penalty_phrase, message))
        if exclude and include:
            return clarify("Indica si quieres incluir o excluir los penales.")
        recognized = bool(re.search(r"\b(tiros?|remates?)\b", message)) or compare or exclude or include
        if not recognized:
            return clarify("Prueba «Muéstrame los tiros de Messi en la final», «Quita los penales» o «Compáralo con Mbappé».")
        if re.search(r"\bpenal\w*\b", message) and not (exclude or include):
            return clarify("Para cambiar el filtro, escribe «quita los penales» o «incluye los penales».")
        if state.scope is None and not re.search(r"\bfinal\b", message):
            return clarify("Indica el partido: por ejemplo, «Muéstrame los tiros de Messi en la final».")
        if not state.scope and not ids:
            return clarify("Indica el jugador: Messi o Mbappé.")
        scope = state.scope.model_copy(deep=True) if state.scope else ShotScope(match_id=gold.final_id, player_ids=ids)
        if compare:
            if len(ids) == 2:
                scope.player_ids = ids
            elif len(ids) == 1 and state.scope:
                scope.player_ids = list(dict.fromkeys([state.scope.player_ids[0], ids[0]]))
            else:
                return clarify("Indica con quién comparar; por ejemplo, «compáralo con Mbappé».")
            if len(scope.player_ids) != 2:
                return clarify("Elige dos jugadores distintos: Messi y Mbappé.")
        elif ids:
            if len(ids) > 1:
                return clarify("Para dos jugadores, pide «compara los tiros de Messi y Mbappé en la final».")
            scope.player_ids = ids
        if re.search(r"\bfinal\b", message):
            scope.match_id = gold.final_id
        if exclude or include:
            scope.exclude_penalties = exclude
        state.scope = scope
        state.selected_event_id = None
        return {"state": state, "detail": False}

    def query(work: Work):
        if work.get("clarification") or work.get("detail"):
            return {}
        scope = work["state"].scope
        tool = "gold_compare_shots" if len(scope.player_ids) == 2 else "gold_shots"
        return {"dataset": getattr(gold, tool)(scope), "tool_name": tool}

    def compose(work: Work):
        state = work["state"]
        previous = work.get("previous")
        if work.get("clarification"):
            response = AgentResponse(status="clarification", explanation=work["clarification"],
                                     visualization_action="retain", visualization=previous.visualization if previous else None,
                                     state=state, applied_filters=state.scope, evidence=previous.evidence if previous else None,
                                     tool_name=None)
        elif work.get("detail"):
            visual = previous.visualization.model_copy(deep=True)
            visual.selected_event_id = state.selected_event_id
            shot = next(s for s in visual.data.shots if s.event_id == state.selected_event_id)
            xg = f"{shot.xg:.3f}" if shot.xg is not None else "no disponible"
            response = AgentResponse(status="result", explanation=f"{shot.player_name}, {shot.minute}:{shot.second:02d}, período {shot.period}. Resultado: {shot.outcome}. xG: {xg}. Evento {shot.event_id}.",
                                     visualization_action="update", visualization=visual, state=state,
                                     applied_filters=state.scope, evidence=previous.evidence, tool_name=None)
        else:
            data = work["dataset"]
            old = previous.visualization if previous else None
            kind = "shot_comparison" if len(state.scope.player_ids) == 2 else "shot_map"
            create = old is None or old.data.scope.match_id != state.scope.match_id
            visual_id = str(uuid4()) if create else old.id
            state.active_visualization_id = visual_id
            title = "Messi y Mbappé" if kind == "shot_comparison" else ("Messi" if "Messi" in data.summaries[0].player_name else "Mbappé")
            visual = Visual(id=visual_id, type=kind, title=f"Tiros · {title}", data=data)
            parts = []
            for s in data.summaries:
                name = "Messi" if "Messi" in s.player_name else "Mbappé"
                parts.append(f"{name}: {s.shots} {'tiro' if s.shots == 1 else 'tiros'}, {s.goals} {'gol' if s.goals == 1 else 'goles'} y " + (f"{s.xg:.2f} xG" if s.xg is not None else "xG no disponible"))
            filters = "Sin penales de partido" if state.scope.exclude_penalties else "Incluye penales de partido"
            response = AgentResponse(status="result" if data.shots else "empty", explanation=". ".join(parts) + f". Final Argentina–Francia. {filters}; tanda excluida.",
                                     visualization_action="create" if create else "update", visualization=visual,
                                     state=state, applied_filters=state.scope, evidence=data.evidence,
                                     tool_name=work["tool_name"])
        return {"response": response}

    graph = StateGraph(Work)
    graph.add_node("resolve", resolve)
    graph.add_node("query", query)
    graph.add_node("compose", compose)
    graph.add_edge(START, "resolve")
    graph.add_edge("resolve", "query")
    graph.add_edge("query", "compose")
    graph.add_edge("compose", END)
    return graph.compile()
