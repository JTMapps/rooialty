# output/formatter.py

import json

def format_for_claude(graph):
    return json.dumps({
        "system_understanding": graph,
        "instruction": "Trace data flow and identify missing links"
    }, indent=2)