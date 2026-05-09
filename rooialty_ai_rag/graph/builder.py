"""
graph/builder.py

Builds a bi-directional relationship graph between frontend files
and database tables, then runs gap-analysis heuristics.
"""

from collections import defaultdict


# ── Tables central to the Recipes feature ────────────────────────────────────
RECIPE_TABLES = {"item_ingredients", "ingredients", "items"}

# ── Files expected to participate in the Recipes feature ─────────────────────
RECIPE_FILES_KEYWORDS = {
    "OfficeRecipes", "IngredientPicker", "useIngredients",
    "useMenu", "OfficeMenuItems",
}


def build_feature_graph(scan_result: dict, db_table_names: list[str]) -> dict:
    """
    Returns a rich graph dict with:
      • table_to_files  – which frontend files touch each DB table
      • file_to_tables  – which DB tables each frontend file touches
      • orphan_tables   – DB tables never referenced in the frontend
      • orphan_files    – frontend Supabase files that reference no known table
      • recipes_analysis– targeted deep-dive on the Recipes feature
      • all_edges       – flat list of (file, table, operations) triples
    """
    supabase_files: list[dict] = scan_result.get("supabase_files", [])
    known_tables = set(db_table_names)

    table_to_files: dict[str, list] = defaultdict(list)
    file_to_tables: dict[str, list] = defaultdict(list)
    all_edges = []

    for entry in supabase_files:
        short_file = _short(entry["file"])
        for table in entry.get("tables", []):
            edge = {
                "file":       short_file,
                "table":      table,
                "operations": entry.get("operations", []),
                "filters":    entry.get("filters", []),
                "selects":    entry.get("selects", []),
                "role":       entry.get("role", "unknown"),
            }
            table_to_files[table].append(edge)
            file_to_tables[short_file].append(table)
            all_edges.append(edge)

    # ── Gap analysis ─────────────────────────────────────────────────────────
    referenced_tables = set(table_to_files.keys())
    orphan_tables = sorted(known_tables - referenced_tables)
    orphan_files  = [
        _short(e["file"]) for e in supabase_files
        if not any(t in known_tables for t in e.get("tables", []))
    ]

    # ── Recipes-specific deep dive ────────────────────────────────────────────
    recipes_analysis = _analyse_recipes(supabase_files, table_to_files)

    return {
        "table_to_files":   dict(table_to_files),
        "file_to_tables":   dict(file_to_tables),
        "orphan_tables":    orphan_tables,
        "orphan_files":     orphan_files,
        "recipes_analysis": recipes_analysis,
        "all_edges":        all_edges,
        "stats": {
            "total_supabase_files": len(supabase_files),
            "total_tables_referenced": len(referenced_tables),
            "total_known_tables": len(known_tables),
        },
    }


def _analyse_recipes(supabase_files: list, table_to_files: dict) -> dict:
    """
    Focused analysis of the Recipes page bug:
      'Select an item' → no ingredients appear.

    Checks which files query item_ingredients, ingredients, and items,
    and surfaces missing joins or absent ingredient-loading logic.
    """
    recipe_file_entries = [
        e for e in supabase_files
        if any(kw in e["file"] for kw in RECIPE_FILES_KEYWORDS)
    ]

    coverage: dict[str, list] = {}
    for table in RECIPE_TABLES:
        files_touching = [
            _short(e["file"]) for e in supabase_files
            if table in e.get("tables", [])
        ]
        coverage[table] = files_touching

    # Detect the specific gap: OfficeRecipes queries items but not item_ingredients
    recipes_page = next(
        (e for e in supabase_files if "OfficeRecipes" in e["file"]), None
    )

    gap_detected = False
    gap_description = ""

    if recipes_page:
        tables_used = set(recipes_page.get("tables", []))
        missing = RECIPE_TABLES - tables_used
        if missing:
            gap_detected = True
            gap_description = (
                f"OfficeRecipes.jsx touches tables {sorted(tables_used)} "
                f"but is MISSING queries to: {sorted(missing)}. "
                "This means item selection cannot load associated ingredients."
            )
        else:
            gap_description = "OfficeRecipes.jsx references all three recipe tables — check filter/state logic."
    else:
        gap_detected = True
        gap_description = (
            "OfficeRecipes.jsx was not found in Supabase-active files. "
            "It may not be importing supabaseClient or delegating to a hook."
        )

    # Check IngredientPicker too
    picker = next(
        (e for e in supabase_files if "IngredientPicker" in e["file"]), None
    )
    picker_summary = (
        {
            "file":       _short(picker["file"]),
            "tables":     picker.get("tables", []),
            "operations": picker.get("operations", []),
            "filters":    picker.get("filters", []),
        }
        if picker else {"note": "IngredientPicker.jsx not found in Supabase-active files"}
    )

    return {
        "involved_files":     [_short(e["file"]) for e in recipe_file_entries],
        "table_coverage":     coverage,
        "gap_detected":       gap_detected,
        "gap_description":    gap_description,
        "office_recipes_detail": {
            "file":       _short(recipes_page["file"]) if recipes_page else None,
            "tables":     recipes_page.get("tables", []) if recipes_page else [],
            "operations": recipes_page.get("operations", []) if recipes_page else [],
            "selects":    recipes_page.get("selects", []) if recipes_page else [],
            "filters":    recipes_page.get("filters", []) if recipes_page else [],
        },
        "ingredient_picker_detail": picker_summary,
        "recommended_fix": _recommend_fix(recipes_page, picker),
    }


def _recommend_fix(recipes_page, picker) -> str:
    """Generate a targeted fix recommendation."""
    if recipes_page is None:
        return (
            "1. Verify OfficeRecipes.jsx imports supabaseClient or a hook that does.\n"
            "2. Add a selectedItem state and trigger a query to item_ingredients "
            "filtered by item_id when the user picks an item.\n"
            "3. Join item_ingredients with ingredients to get ingredient names/units."
        )

    tables = set(recipes_page.get("tables", []))

    if "item_ingredients" not in tables:
        return (
            "OfficeRecipes.jsx never queries the `item_ingredients` table.\n\n"
            "Fix:\n"
            "  When the user selects a menu item, run:\n"
            "    supabase\n"
            "      .from('item_ingredients')\n"
            "      .select('*, ingredients(*)')\n"
            "      .eq('item_id', selectedItem.id)\n\n"
            "  Store the result in a `recipeIngredients` state variable and "
            "render it in the IngredientPicker or a list below the item selector."
        )

    if "ingredients" not in tables:
        return (
            "`item_ingredients` is queried but `ingredients` is not joined.\n\n"
            "Fix: extend the select to include the ingredients relation:\n"
            "  .select('quantity, unit, ingredients(id, name, unit)')\n"
            "  .eq('item_id', selectedItem.id)"
        )

    return (
        "All three tables are referenced — the bug is likely in state/effect logic.\n"
        "Check that:\n"
        "  • The query runs inside a useEffect that depends on [selectedItem]\n"
        "  • selectedItem is not null/undefined when the query fires\n"
        "  • The result is stored in state and passed to the ingredient list component"
    )


def _short(file_path: str) -> str:
    """Trim absolute path to just src/... for readability."""
    for marker in ("src/", "src\\"):
        idx = file_path.find(marker)
        if idx != -1:
            return file_path[idx:].replace("\\", "/")
    return file_path.replace("\\", "/").split("/")[-1]