"""Shared paths and integrity helpers for the read-only Gold serving data."""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]


class GoldUnavailable(RuntimeError):
    pass


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()
