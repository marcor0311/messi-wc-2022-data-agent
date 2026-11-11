"""Durable snapshots. Activating history never rewrites an earlier turn."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from uuid import uuid4

from app.agent.models import AgentResponse


class NotFound(ValueError):
    pass


class StaleTurn(ValueError):
    pass


class ConversationStore:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY, active_turn_id TEXT, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS turns (
                    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
                    parent_turn_id TEXT REFERENCES turns(id), message TEXT NOT NULL,
                    response TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS turns_conversation ON turns(conversation_id);
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def now():
        return datetime.now(timezone.utc).isoformat()

    def create(self):
        identity = str(uuid4())
        with self.connect() as db:
            db.execute("INSERT INTO conversations VALUES (?, NULL, ?)", (identity, self.now()))
        return self.get(identity)

    def conversation(self, db, identity):
        row = db.execute("SELECT * FROM conversations WHERE id=?", (identity,)).fetchone()
        if row is None:
            raise NotFound("No se encontró la conversación. Inicia una nueva.")
        return row

    @staticmethod
    def turn(row):
        result = dict(row)
        result["response"] = json.loads(result["response"])
        return result

    def get(self, identity):
        with self.connect() as db:
            db.execute("BEGIN")
            row = self.conversation(db, identity)
            turns = db.execute("SELECT * FROM turns WHERE conversation_id=? ORDER BY rowid", (identity,)).fetchall()
            return {**dict(row), "turns": [self.turn(t) for t in turns]}

    def append(self, identity, request, agent):
        # Serialize edits to a conversation; a stale browser cannot change context.
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            conversation = self.conversation(db, identity)
            if conversation["active_turn_id"] != request.base_turn_id:
                raise StaleTurn("El contexto cambió. Recarga la conversación antes de continuar.")
            previous = None
            if request.base_turn_id:
                row = db.execute("SELECT response FROM turns WHERE id=? AND conversation_id=?",
                                 (request.base_turn_id, identity)).fetchone()
                previous = AgentResponse.model_validate_json(row["response"])
            response = agent.invoke({"message": request.message, "previous": previous,
                                     "selected_event_id": request.selected_event_id})["response"]
            turn_id = str(uuid4())
            created = self.now()
            db.execute("INSERT INTO turns VALUES (?, ?, ?, ?, ?, ?)",
                       (turn_id, identity, request.base_turn_id, request.message, response.model_dump_json(), created))
            db.execute("UPDATE conversations SET active_turn_id=? WHERE id=?", (turn_id, identity))
            return {"id": turn_id, "conversation_id": identity, "parent_turn_id": request.base_turn_id,
                    "message": request.message, "response": response.model_dump(mode="json"), "created_at": created}

    def activate(self, identity, turn_id, expected):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            conversation = self.conversation(db, identity)
            if conversation["active_turn_id"] != expected:
                raise StaleTurn("El contexto cambió. Recarga la conversación antes de continuar.")
            exists = db.execute("SELECT 1 FROM turns WHERE id=? AND conversation_id=?", (turn_id, identity)).fetchone()
            if not exists:
                raise NotFound("Ese turno no pertenece a esta conversación.")
            db.execute("UPDATE conversations SET active_turn_id=? WHERE id=?", (turn_id, identity))
        return self.get(identity)
