import logging

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from app.agent.routes import analytics, router as data_agent_router
from app.db.gold import GoldUnavailable

app = FastAPI(title="Messi WC2022 Data Agent API", version="0.2.0")
logger = logging.getLogger(__name__)


@app.exception_handler(GoldUnavailable)
async def gold_unavailable(request: Request, exc: GoldUnavailable):
    logger.warning("Gold unavailable", exc_info=exc)
    return JSONResponse(status_code=503, content={"detail": str(exc), "recoverable": True})


@app.exception_handler(Exception)
async def failed(request: Request, exc: Exception):
    logger.exception("Request failed", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "No se pudo completar la consulta. Intenta de nuevo.", "recoverable": True})


@app.get("/api/health")
def health(a=Depends(analytics)):
    return {"status": "ok", "gold_load_id": a.catalog["load_id"], "agent": "data_agent_langgraph"}


app.include_router(data_agent_router)
