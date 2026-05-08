def format_column(col, enum_map):
    col_type = col["data_type"]

    if col_type in enum_map:
        values = " | ".join(enum_map[col_type])
        col_type = f"{col_type} ({values})"

    return f"- {col['column_name']} ({col_type})"


def build_table_doc(table_name, data, enum_map):
    lines = []

    lines.append(f"TABLE: {table_name}\n")

    # Columns
    lines.append("COLUMNS:")
    for col in data["columns"]:
        lines.append(format_column(col, enum_map))

    # Constraints
    if data["constraints"]:
        lines.append("\nCONSTRAINTS:")
        for c in data["constraints"]:
            lines.append(f"- {c['constraint_definition']}")

    # Relationships
    from .enricher import extract_relationships
    rels = extract_relationships(data["constraints"])

    if rels:
        lines.append("\nRELATIONSHIPS:")
        for r in rels:
            lines.append(f"- {r}")

    # Business Rules
    from .enricher import extract_business_rules
    rules = extract_business_rules(data["constraints"])

    if rules:
        lines.append("\nBUSINESS RULES:")
        for r in rules:
            lines.append(f"- {r}")

    return "\n".join(lines)


def build_all_docs(tables, enum_map):
    docs = {}

    for table_name, data in tables.items():
        docs[table_name] = build_table_doc(table_name, data, enum_map)

    return docs