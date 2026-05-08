from .config import OUTPUT_DIR


def export_documents(docs):
    for name, content in docs.items():
        file_path = OUTPUT_DIR / f"{name}.txt"

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)


def export_combined(docs):
    combined_path = OUTPUT_DIR / "all_tables.txt"

    with open(combined_path, "w", encoding="utf-8") as f:
        for name, content in docs.items():
            f.write(content)
            f.write("\n\n" + "="*80 + "\n\n")