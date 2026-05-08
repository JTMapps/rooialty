# ingest/frontend_scanner.py

from pathlib import Path
from processors.query_extractor import extract_queries_from_file

def scan_frontend(src_path):
    results = []

    for file in Path(src_path).rglob("*.js"):
        results.append(extract_queries_from_file(file))
    for file in Path(src_path).rglob("*.jsx"):
        results.append(extract_queries_from_file(file))

    return results