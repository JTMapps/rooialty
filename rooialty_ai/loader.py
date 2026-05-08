import json
from pathlib import Path
from .config import SCHEMA_DIR


def load_json(file_path: Path):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_schema():
    return {
        "columns": load_json(SCHEMA_DIR / "table+column.json"),
        "constraints": load_json(SCHEMA_DIR / "constraints.json"),
        "enums": load_json(SCHEMA_DIR / "enums.json"),
        "indexes": load_json(SCHEMA_DIR / "indexes.json"),
        "rls": load_json(SCHEMA_DIR / "rls_policies.json"),
        "triggers": load_json(SCHEMA_DIR / "triggers.json"),
    }