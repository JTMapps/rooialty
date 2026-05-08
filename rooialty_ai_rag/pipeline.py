from ingest.frontend_scanner import scan_frontend
from graph.builder import build_feature_graph
from output.formatter import format_for_claude

from pathlib import Path


def main():
    # 🔧 adjust if needed
    SRC_PATH = Path("../src")
    OUTPUT_PATH = Path("output/claude_context.json")

    print("🔍 Scanning frontend...")
    frontend_data = scan_frontend(SRC_PATH)

    print("🧠 Building graph...")
    graph = build_feature_graph(frontend_data, schema=None)

    print("📦 Formatting for Claude...")
    result = format_for_claude(graph)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(result)

    print(f"✅ Done! Output saved to: {OUTPUT_PATH.resolve()}")


if __name__ == "__main__":
    main()