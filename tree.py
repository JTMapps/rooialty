"""
tree.py — Drop this file anywhere and run `python tree.py` from that folder.
Prints the directory tree, skipping common noise folders (node_modules, .git, etc.)
"""

import os
import sys

# ── Folders to skip entirely ──────────────────────────────────────────────────
IGNORE_DIRS = {
    "node_modules", ".git", ".svn", "__pycache__", ".venv", "venv",
    ".env", "env", "dist", "build", ".next", ".nuxt", ".output",
    "coverage", ".nyc_output", ".turbo", ".cache", ".parcel-cache",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", ".angular",
    "vendor", "bin", "obj", ".idea", ".vscode", ".vs",
}

# ── Files to skip ─────────────────────────────────────────────────────────────
IGNORE_FILES = {
    ".DS_Store", "Thumbs.db", "desktop.ini",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    ".package-lock.json",
}

# ── File extensions to skip ───────────────────────────────────────────────────
IGNORE_EXTENSIONS = {
    ".pyc", ".pyo", ".pyd",
    ".class", ".o", ".obj", ".a", ".lib", ".dll", ".so", ".dylib",
    ".log", ".tmp", ".temp",
}


def should_skip_dir(name: str) -> bool:
    return name in IGNORE_DIRS or name.startswith(".")


def should_skip_file(name: str) -> bool:
    if name in IGNORE_FILES:
        return True
    _, ext = os.path.splitext(name)
    return ext in IGNORE_EXTENSIONS


def build_tree(root: str, prefix: str = "") -> list:
    lines = []

    try:
        raw = list(os.scandir(root))
    except PermissionError:
        return [prefix + "    [Permission Denied]"]

    # Filter, then sort: dirs first, then files, both alphabetically
    dirs  = sorted([e for e in raw if e.is_dir()  and not should_skip_dir(e.name)],  key=lambda e: e.name.lower())
    files = sorted([e for e in raw if e.is_file() and not should_skip_file(e.name)], key=lambda e: e.name.lower())
    all_entries = dirs + files

    for i, entry in enumerate(all_entries):
        is_last   = i == len(all_entries) - 1
        connector = "└───" if is_last else "├───"
        extension = "    " if is_last else "│   "

        lines.append(f"{prefix}{connector}{entry.name}")

        if entry.is_dir():
            lines.extend(build_tree(entry.path, prefix + extension))

    return lines


def main():
    root      = os.path.dirname(os.path.abspath(__file__))
    root_name = os.path.basename(root)

    try:
        raw = list(os.scandir(root))
    except PermissionError:
        print(f"{root_name}\n[Permission Denied]")
        sys.exit(1)

    dirs  = sorted([e for e in raw if e.is_dir()  and not should_skip_dir(e.name)],  key=lambda e: e.name.lower())
    files = sorted([e for e in raw if e.is_file() and not should_skip_file(e.name)], key=lambda e: e.name.lower())
    all_entries = dirs + files

    print(root_name)

    for i, entry in enumerate(all_entries):
        is_last   = i == len(all_entries) - 1
        connector = "└───" if is_last else "├───"
        extension = "    " if is_last else "│   "

        print(f"{connector}{entry.name}")

        if entry.is_dir():
            for line in build_tree(entry.path, extension):
                print(line)


if __name__ == "__main__":
    main()