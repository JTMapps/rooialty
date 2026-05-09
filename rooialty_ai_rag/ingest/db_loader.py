"""
ingest/db_loader.py

Loads the pre-generated database knowledge from:
  • rooialty_ai/output/*.txt   (table-level descriptions)
  • schema/*.json              (structural schema artefacts)

These files were already produced by the rooialty_ai pipeline and
give Claude a rich understanding of the PostgreSQL schema without
needing a live DB connection.
"""

import json
from pathlib import Path


def load_db_output(output_dir: Path) -> dict:
    """
    Read every .txt file in rooialty_ai/output/ and return a dict
    keyed by table name (derived from filename).
    """
    output_dir = Path(output_dir)
    tables = {}

    if not output_dir.exists():
        return tables

    for txt_file in sorted(output_dir.glob("*.txt")):
        table_name = txt_file.stem          # e.g. "item_ingredients"
        try:
            content = txt_file.read_text(encoding="utf-8", errors="ignore").strip()
            tables[table_name] = content
        except Exception as exc:
            tables[table_name] = f"[ERROR reading file: {exc}]"

    return tables


def load_schema(schema_dir: Path) -> dict:
    """
    Read every .json file in schema/ and return a merged dict.
    """
    schema_dir = Path(schema_dir)
    schema = {}

    if not schema_dir.exists():
        return schema

    for json_file in sorted(schema_dir.glob("*.json")):
        try:
            data = json.loads(
                json_file.read_text(encoding="utf-8", errors="ignore")
            )
            schema[json_file.stem] = data
        except Exception as exc:
            schema[json_file.stem] = {"error": str(exc)}

    return schema


def extract_table_names(db_output: dict) -> list[str]:
    """Return sorted list of known DB table names."""
    # Remove meta-keys that aren't actual tables
    skip = {"all_tables"}
    return sorted(k for k in db_output if k not in skip)