from functools import lru_cache
import logging
import os
from pathlib import Path
from threading import Lock
from uuid import UUID

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from app.agent.graph import build_agent
from app.agent.models import ActivateRequest, ConversationResponse, TurnRequest, TurnResponse
from app.db.conversations import ConversationStore, NotFound, StaleTurn
from app.db.gold import GoldRepository, GoldUnavailable, ROOT

app = FastAPI(title="WC2022 conversation API", version="0.1.0")
logger = logging.getLogger(__name__)
_gold_lock = Lock()


@lru_cache
def _load_gold():
    return GoldRepository()


def get_gold():
    # functools caches do not serialize concurrent first calls. Verify the large
    # artifact once even if several conversations arrive during cold startup.
    with _gold_lock:
        return _load_gold()


@lru_cache
def get_agent():
    return build_agent(get_gold())


@lru_cache
def get_store():
    return ConversationStore(Path(os.environ.get("CONVERSATION_DB", ROOT / "data/conversations.sqlite3")))


def complete_history(conversation):
    legacy = [turn for turn in conversation["turns"]
              if turn["response"].get("visualization")
              and turn["response"]["visualization"]["data"].get("endpoint_data_version", 0) == 0]
    if not legacy:
        return conversation
    try:
        gold = get_gold()
        for turn in legacy:
            turn["response"] = gold.complete_destinations(turn["response"])
    except (GoldUnavailable, ValueError):
        # History remains readable when its original source is unavailable.
        logger.warning("Could not complete historical destinations", exc_info=True)
    return conversation


@app.exception_handler(NotFound)
async def missing(request: Request, exc: NotFound):
    return JSONResponse(status_code=404, content={"detail": str(exc), "recoverable": True})


@app.exception_handler(StaleTurn)
async def stale(request: Request, exc: StaleTurn):
    return JSONResponse(status_code=409, content={"detail": str(exc), "recoverable": True})


@app.exception_handler(GoldUnavailable)
async def gold_unavailable(request: Request, exc: GoldUnavailable):
    logger.warning("Gold unavailable", exc_info=exc)
    return JSONResponse(status_code=503, content={"detail": str(exc), "recoverable": True})


@app.exception_handler(Exception)
async def failed(request: Request, exc: Exception):
    logger.exception("Conversation request failed", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "No se pudo completar la consulta. Tu resultado anterior se conserva. Intenta de nuevo.", "recoverable": True})


@app.get("/api/health")
def health(gold=Depends(get_gold)):
    return {"status": "ok", "gold_load_id": gold.manifest["load_id"], "agent": "bounded_intents_v1"}


@app.post("/api/conversations", status_code=201, response_model=ConversationResponse)
def create_conversation(store=Depends(get_store)):
    return store.create()


@app.get("/api/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(conversation_id: UUID, store=Depends(get_store)):
    return complete_history(store.get(str(conversation_id)))


@app.post("/api/conversations/{conversation_id}/turns", status_code=201, response_model=TurnResponse)
def create_turn(conversation_id: UUID, request: TurnRequest, store=Depends(get_store), agent=Depends(get_agent)):
    turn = store.append(str(conversation_id), request, agent)
    return complete_history({"turns": [turn]})["turns"][0]


@app.post("/api/conversations/{conversation_id}/activate", response_model=ConversationResponse)
def activate_turn(conversation_id: UUID, request: ActivateRequest, store=Depends(get_store)):
    return complete_history(store.activate(str(conversation_id), request.turn_id, request.expected_active_turn_id))
