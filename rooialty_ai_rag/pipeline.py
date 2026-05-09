# rooialty_ai_rag/pipeline.py
# Full system-architecture RAG pipeline.
# Uses actual exported functions from each module.

from pathlib import Path

from .ingest.db_loader        import load_db_output, load_schema, extract_table_names
from .ingest.frontend_scanner import scan_frontend
from .graph.builder           import build_feature_graph
from .output.formatter        import format_context

# ── Paths (resolved relative to this file's location) ────────────────────────
_ROOT       = Path(__file__).parent.parent          # C:\Users\tshep\Rooialty
_SRC        = _ROOT / "src"
_DB_OUTPUT  = _ROOT / "rooialty_ai" / "output"
_SCHEMA_DIR = _ROOT / "schema"

DIVIDER = "═" * 60


def run():
    print(f"\n{DIVIDER}")
    print("  ROOIALTY RAG PIPELINE  —  Full Architecture Analysis")
    print(f"{DIVIDER}\n")

    # ── 1. Frontend scan ──────────────────────────────────────────
    scan = scan_frontend(_SRC)
    all_files      = scan["all_files"]
    supabase_files = scan["supabase_files"]
    print(f"🔍  Scanning frontend:  {_SRC}")
    print(f"    ✓ {scan['total_scanned']} files scanned, "
          f"{scan['total_supabase']} use Supabase\n")

    # ── 2. DB descriptions + schema ───────────────────────────────
    db_descriptions = load_db_output(_DB_OUTPUT)
    schema          = load_schema(_SCHEMA_DIR)
    known_tables    = extract_table_names(db_descriptions)
    print(f"🗄️   Loading DB output: {_DB_OUTPUT}")
    print(f"    ✓ {len(db_descriptions)} table description files loaded\n")
    print(f"📐  Loading schema:    {_SCHEMA_DIR}")
    print(f"    ✓ {len(schema)} schema artefacts loaded")
    print(f"    ✓ {len(known_tables)} known DB tables: {known_tables}\n")

    # ── 3. Relationship graph ─────────────────────────────────────
    graph = build_feature_graph(scan, known_tables)
    stats = graph["stats"]
    print(f"🧠  Building relationship graph…")
    print(f"    ✓ {stats['total_supabase_files']} frontend files  →  "
          f"{stats['total_tables_referenced']}/{stats['total_known_tables']} DB tables")

    if graph["orphan_tables"]:
        print(f"    ⚠️  Orphan DB tables (never queried): {graph['orphan_tables']}")
    if graph["orphan_files"]:
        print(f"    ⚠️  Orphan frontend files (no known table): {graph['orphan_files']}")
    print()

    # ── 4. Full architecture analysis ────────────────────────────
    print(f"🏗️   Running full architecture analysis…")
    architecture = _analyse_architecture(supabase_files, graph, known_tables, schema)
    for line in architecture["summary_lines"]:
        print(f"    {line}")
    print()

    # ── 5. Format + write output ──────────────────────────────────
    print(f"📦  Formatting context for Claude…\n")
    json_path, txt_path = format_context(
        all_files       = all_files,
        supabase_files  = supabase_files,
        db_descriptions = db_descriptions,
        schema          = schema,
        known_tables    = known_tables,
        graph           = graph,
        architecture    = architecture,
    )

    print(f"✅  Done!")
    print(f"    JSON  →  {json_path}")
    print(f"    TXT   →  {txt_path}")
    print(f"\n    Feed claude_context.json to Claude with the prompt:")
    print(f'    "Using the architecture map, explain how [feature]')
    print(f'     works end-to-end from the frontend to the database."')
    print(f"\n{DIVIDER}\n")


# ─────────────────────────────────────────────────────────────────
# Full architecture analysis
# ─────────────────────────────────────────────────────────────────

def _analyse_architecture(supabase_files, graph, known_tables, schema):
    """
    Produces a full-system awareness document across ALL tables and files:
    - Per-table: readers, writers, realtime, filtered columns
    - Per-file:  role classification (hook / page / component / utility)
    - Cross-cutting: read-only tables, direct writes bypassing hooks,
      enum usage, filtered column catalogue
    """
    table_to_files = graph["table_to_files"]   # { table: [edge, ...] }

    # ── Classify files by role ────────────────────────────────────
    hooks      = {}
    pages      = {}
    components = {}
    utilities  = {}

    for entry in supabase_files:
        short = _short(entry["file"])
        role  = entry.get("role", "utility")
        bucket = (
            hooks      if role == "hook"      else
            pages      if role == "page"      else
            components if role == "component" else
            utilities
        )
        bucket[short] = {
            "tables":     entry.get("tables", []),
            "operations": entry.get("operations", []),
            "realtime":   entry.get("realtime", False),
        }

    # ── Per-table operation coverage ─────────────────────────────
    table_ops = {}
    for table in known_tables:
        edges    = table_to_files.get(table, [])
        ops      = set()
        realtime = False
        readers  = []
        writers  = []
        for e in edges:
            ops.update(e.get("operations", []))
            if e.get("realtime"):
                realtime = True
            if any(o in e.get("operations", []) for o in ("insert", "update", "delete", "upsert")):
                writers.append(e["file"])
            if "select" in e.get("operations", []):
                readers.append(e["file"])
        table_ops[table] = {
            "operations": sorted(ops),
            "realtime":   realtime,
            "readers":    readers,
            "writers":    writers,
        }

    # ── Read-only tables ──────────────────────────────────────────
    read_only_tables = [
        t for t, info in table_ops.items()
        if info["operations"] and
           not any(o in info["operations"] for o in ("insert", "update", "delete", "upsert"))
    ]

    # ── Direct writes from pages/components (bypassing hooks) ────
    direct_write_files = []
    for table, edges in table_to_files.items():
        for e in edges:
            f = e.get("file", "")
            is_page_or_component = "/pages/" in f or "/components/" in f
            write_ops = [o for o in e.get("operations", [])
                         if o in ("insert", "update", "delete", "upsert")]
            if is_page_or_component and write_ops:
                direct_write_files.append({
                    "file":  f,
                    "table": table,
                    "ops":   write_ops,
                })

    # ── Enum catalogue ────────────────────────────────────────────
    enum_types = {}
    for item in schema.get("enums", []):
        name = item.get("enum_name") or item.get("name", "")
        vals = item.get("values") or item.get("enum_values", [])
        if name:
            enum_types[name] = vals

    # ── Filtered columns per table ────────────────────────────────
    filtered_columns = {}
    for table, edges in table_to_files.items():
        cols = set()
        for e in edges:
            for f in e.get("filters", []):
                col = f.get("column")
                if col:
                    cols.add(col)
        if cols:
            filtered_columns[table] = sorted(cols)

    # ── Summary lines for terminal ────────────────────────────────
    summary_lines = [
        f"✓ {len(known_tables)} DB tables analysed",
        f"✓ {len([t for t in table_ops if table_ops[t]['operations']])} tables have frontend coverage",
        f"✓ {len(read_only_tables)} read-only tables: {read_only_tables}",
        f"✓ {len(direct_write_files)} direct writes from pages/components",
        f"✓ {len(graph['orphan_tables'])} uncovered DB tables: {graph['orphan_tables']}",
        f"✓ {len(enum_types)} enums in schema",
    ]

    return {
        "summary_lines":      summary_lines,
        "table_ops":          table_ops,
        "read_only_tables":   read_only_tables,
        "direct_write_files": direct_write_files,
        "enum_types":         enum_types,
        "hooks":              hooks,
        "pages":              pages,
        "components":         components,
        "utilities":          utilities,
        "filtered_columns":   filtered_columns,
        "uncovered_tables":   graph["orphan_tables"],
    }


def _short(file_path: str) -> str:
    idx = file_path.replace("\\", "/").find("src/")
    if idx != -1:
        return file_path[idx:].replace("\\", "/")
    return file_path.replace("\\", "/").split("/")[-1]


if __name__ == "__main__":
    run()