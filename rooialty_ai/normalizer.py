from collections import defaultdict


def safe_table_name(obj):
    """
    Attempts to safely resolve a table name
    from various schema export formats.
    """

    possible_keys = [
        "table_name",
        "tablename",
        "table",
        "relation_name",
    ]

    for key in possible_keys:
        if key in obj:
            return obj[key]

    return None


def build_table_map(schema):
    tables = defaultdict(lambda: {
        "columns": [],
        "constraints": [],
        "indexes": [],
        "triggers": [],
        "rls": [],
    })

    # Columns
    for col in schema["columns"]:
        table_name = safe_table_name(col)

        if table_name:
            tables[table_name]["columns"].append(col)

    # Constraints
    for c in schema["constraints"]:
        table_name = safe_table_name(c)

        if table_name:
            tables[table_name]["constraints"].append(c)

    # Indexes
    for idx in schema["indexes"]:
        table_name = safe_table_name(idx)

        if table_name:
            tables[table_name]["indexes"].append(idx)

    # Triggers
    for trg in schema["triggers"]:
        table_name = safe_table_name(trg)

        if table_name:
            tables[table_name]["triggers"].append(trg)

    # RLS Policies
    for policy in schema["rls"]:
        table_name = safe_table_name(policy)

        if table_name:
            tables[table_name]["rls"].append(policy)

    return tables


def build_enum_map(schema):
    enum_map = {}

    for e in schema["enums"]:
        enum_map.setdefault(
            e["enum_type"],
            []
        ).append(e["enum_label"])

    return enum_map