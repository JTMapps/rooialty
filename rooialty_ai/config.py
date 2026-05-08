from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SCHEMA_DIR = BASE_DIR / "schema"
OUTPUT_DIR = BASE_DIR / "rooialty_ai" / "output"

OUTPUT_DIR.mkdir(exist_ok=True)