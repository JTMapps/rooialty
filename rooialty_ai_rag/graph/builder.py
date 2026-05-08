# graph/builder.py

def build_feature_graph(frontend_queries, schema):
    graph = []

    for entry in frontend_queries:
        for table in entry["tables"]:
            graph.append({
                "file": entry["file"],
                "table": table
            })

    return graph