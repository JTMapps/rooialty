"""
ingest/frontend_scanner.py

Walks the src/ directory and extracts Supabase query metadata from
every .js and .jsx file found.
"""

from pathlib import Path
from processors.query_extractor import extract_queries_from_file


def scan_frontend(src_path: Path) -> list[dict]:
    """
    Recursively scan *src_path* for JS/JSX files and return a list
    of extraction results (one dict per file).
    """
    src_path = Path(src_path)
    if not src_path.exists():
        raise FileNotFoundError(f"Frontend source path not found: {src_path.resolve()}")

    results = []
    extensions = ("*.js", "*.jsx", "*.ts", "*.tsx")

    for ext in extensions:
        for file in sorted(src_path.rglob(ext)):
            results.append(extract_queries_from_file(file))

    # Surface only files that actually use Supabase
    supabase_files = [r for r in results if r.get("uses_supabase")]
    all_files      = results

    return {
        "all_files":      all_files,
        "supabase_files": supabase_files,
        "total_scanned":  len(all_files),
        "total_supabase": len(supabase_files),
    }