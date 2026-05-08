def extract_relationships(constraints):
    relationships = []

    for c in constraints:
        definition = c["constraint_definition"]

        if "FOREIGN KEY" in definition:
            relationships.append(definition)

    return relationships


def extract_business_rules(constraints):
    rules = []

    for c in constraints:
        definition = c["constraint_definition"]

        if "CHECK" in definition:
            rules.append(definition)

    return rules


def infer_lifecycle(enum_map):
    lifecycle = {}

    if "order_status" in enum_map:
        lifecycle["order_status"] = " → ".join(enum_map["order_status"])

    return lifecycle