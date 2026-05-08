# rooialty_ai_rag/processors/query_extractor.py

import re
from pathlib import Path

QUERY_PATTERN = re.compile(r'from\(["\'](\w+)["\']\)')

def extract_queries_from_file(file_path):
    content = Path(file_path).read_text()
    
    tables = QUERY_PATTERN.findall(content)
    
    return {
        "file": str(file_path),
        "tables": list(set(tables))
    }