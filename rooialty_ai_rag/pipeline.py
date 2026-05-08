"""
pipeline.py  –  rooialty_ai_rag

Entry point.  Run from inside the rooialty_ai_rag/ directory:

    cd rooialty_ai_rag
    python pipeline.py

Or from the project root:

    python rooialty_ai_rag/pipeline.py
"""

import sys
from pathlib import Path

# ── Make sure sibling packages resolve correctly regardless of CWD ────────────
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from ingest.frontend_scanner import scan_frontend
from ingest.db_loader        import load_db_output, load_schema, extract_table_names
from graph.builder           import build_feature_graph
from output.formatter        import format_for_claude, write_outputs


# ── Path configuration ────────────────────────────────────────────────────────
ROOT          = _HERE.parent                        # Rooialty/
SRC_PATH      = ROOT / "src"                        # Rooialty/src/
DB_OUTPUT_DIR = ROOT / "rooialty_ai" / "output"    # Rooialty/rooialty_ai/output/
SCHEMA_DIR    = ROOT / "schema"                     # Rooialty/schema/
OUTPUT_DIR    = _HERE / "output"                    # Rooialty/rooialty_ai_rag/output/


def main():
    print("\n" + "═" * 60)
    print("  ROOIALTY RAG PIPELINE")
    print("═" * 60)

    # ── Step 1: Scan frontend ─────────────────────────────────────────────────
    print(f"\n🔍  Scanning frontend:  {SRC_PATH}")
    scan_result = scan_frontend(SRC_PATH)
    print(
        f"    ✓ {scan_result['total_scanned']} files scanned, "
        f"{scan_result['total_supabase']} use Supabase"
    )

    # ── Step 2: Load DB knowledge ─────────────────────────────────────────────
    print(f"\n🗄️   Loading DB output: {DB_OUTPUT_DIR}")
    db_output = load_db_output(DB_OUTPUT_DIR)
    print(f"    ✓ {len(db_output)} table description files loaded")

    print(f"\n📐  Loading schema:    {SCHEMA_DIR}")
    schema = load_schema(SCHEMA_DIR)
    print(f"    ✓ {len(schema)} schema artefacts loaded")

    db_table_names = extract_table_names(db_output)
    print(f"    ✓ {len(db_table_names)} known DB tables: {db_table_names}")

    # ── Step 3: Build relationship graph ─────────────────────────────────────
    print("\n🧠  Building relationship graph…")
    graph = build_feature_graph(scan_result, db_table_names)
    stats = graph["stats"]
    print(
        f"    ✓ {stats['total_supabase_files']} frontend files  →  "
        f"{stats['total_tables_referenced']}/{stats['total_known_tables']} DB tables"
    )

    if graph["orphan_tables"]:
        print(f"    ⚠️  Orphan DB tables (never queried): {graph['orphan_tables']}")
    if graph["orphan_files"]:
        print(f"    ⚠️  Orphan frontend files (no known table): {graph['orphan_files']}")

    # ── Step 4: Recipes bug report ────────────────────────────────────────────
    ra = graph["recipes_analysis"]
    print("\n🍽️   Recipes page analysis:")
    status = "❌  GAP DETECTED" if ra["gap_detected"] else "✅  Coverage OK"
    print(f"    {status}")
    print(f"    {ra['gap_description']}")
    print("\n    Recommended fix:")
    for line in ra["recommended_fix"].splitlines():
        print(f"      {line}")

    # ── Step 5: Format & write output ─────────────────────────────────────────
    print(f"\n📦  Formatting context for Claude…")
    context = format_for_claude(graph, db_output, schema, scan_result)

    json_path, txt_path = write_outputs(context, OUTPUT_DIR)
    print(f"\n✅  Done!")
    print(f"    JSON  →  {json_path.resolve()}")
    print(f"    TXT   →  {txt_path.resolve()}")
    print(
        "\n    Feed claude_context.json to Claude Sonnet with the prompt:\n"
        '    "Analyse the primary_bug section and show me the exact code\n'
        '     I need to add/change in OfficeRecipes.jsx to fix the\n'
        '     ingredient-loading issue."\n'
    )
    print("═" * 60 + "\n")


if __name__ == "__main__":
    main()