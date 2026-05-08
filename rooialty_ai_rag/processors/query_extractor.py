"""
processors/query_extractor.py

Extracts Supabase query patterns from frontend JS/JSX files.
Handles UTF-8 encoding to prevent cp1252 decode errors on Windows.
"""

import re
from pathlib import Path

# ── Supabase client patterns ─────────────────────────────────────────────────
_FROM        = re.compile(r'\.from\(\s*["\'](\w+)["\']\s*\)')
_SELECT      = re.compile(r'\.select\(\s*["\']([^"\']+)["\']\s*\)')
_EQ          = re.compile(r'\.eq\(\s*["\'](\w+)["\']\s*,')
_NEQ         = re.compile(r'\.neq\(\s*["\'](\w+)["\']\s*,')
_FILTER_OP   = re.compile(r'\.(gt|lt|gte|lte|like|ilike|in|contains|overlaps)\(\s*["\'](\w+)["\']\s*,')
_INSERT      = re.compile(r'\.insert\(')
_UPDATE      = re.compile(r'\.update\(')
_DELETE      = re.compile(r'\.delete\(')
_UPSERT      = re.compile(r'\.upsert\(')
_RPC         = re.compile(r'\.rpc\(\s*["\'](\w+)["\']\s*[,)]')
_SUBSCRIBE   = re.compile(r'\.channel\(|\.on\(|\.subscribe\(')
_IMPORT_SB   = re.compile(r'import\s+.*?supabase', re.IGNORECASE)

# Hook / component role detection
_IS_PAGE     = re.compile(r'(Page|Screen|View|Layout)\b')
_IS_HOOK     = re.compile(r'^use[A-Z]')
_IS_COMPONENT= re.compile(r'^[A-Z][a-zA-Z]+\.(jsx|tsx)$')


def extract_queries_from_file(file_path: Path) -> dict:
    """
    Parse a single JS/JSX file and return a structured dict of all
    Supabase interactions found inside it.
    """
    # ── FIX: always decode as UTF-8, skip undecodeable bytes ─────────────────
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        return {
            "file": str(file_path),
            "error": str(exc),
            "tables": [], "selects": [], "filters": [],
            "operations": [], "rpc_calls": [], "realtime": False,
            "uses_supabase": False, "role": "unknown",
        }

    uses_supabase = bool(_IMPORT_SB.search(content)) or ".from(" in content

    tables   = list(dict.fromkeys(_FROM.findall(content)))      # preserves order, deduped
    selects  = _SELECT.findall(content)
    rpc_calls= _RPC.findall(content)
    realtime = bool(_SUBSCRIBE.search(content))

    # Build a flat list of filter conditions
    filters = []
    for col in _EQ.findall(content):
        filters.append({"op": "eq",  "column": col})
    for col in _NEQ.findall(content):
        filters.append({"op": "neq", "column": col})
    for op, col in _FILTER_OP.findall(content):
        filters.append({"op": op,    "column": col})

    operations = []
    if selects or tables:                      operations.append("select")
    if _INSERT.search(content):                operations.append("insert")
    if _UPDATE.search(content):                operations.append("update")
    if _DELETE.search(content):                operations.append("delete")
    if _UPSERT.search(content):                operations.append("upsert")

    # Infer the role of this file
    stem = file_path.stem
    if _IS_HOOK.match(stem):
        role = "hook"
    elif _IS_PAGE.search(stem):
        role = "page"
    elif _IS_COMPONENT.match(file_path.name):
        role = "component"
    else:
        role = "utility"

    return {
        "file":         str(file_path).replace("\\", "/"),
        "role":         role,
        "uses_supabase": uses_supabase,
        "tables":       tables,
        "selects":      selects,
        "filters":      filters,
        "operations":   list(dict.fromkeys(operations)),
        "rpc_calls":    rpc_calls,
        "realtime":     realtime,
    }