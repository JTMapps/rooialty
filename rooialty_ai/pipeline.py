from .loader import load_schema
from .normalizer import build_table_map, build_enum_map
from .document_builder import build_all_docs
from .exporter import export_documents, export_combined
from .enricher import infer_lifecycle


def run():
    print("Loading schema...")
    schema = load_schema()

    print("Normalizing...")
    tables = build_table_map(schema)
    enum_map = build_enum_map(schema)

    print("Building documents...")
    docs = build_all_docs(tables, enum_map)

    print("Exporting...")
    export_documents(docs)
    export_combined(docs)

    print("Done ✅")


if __name__ == "__main__":
    run()