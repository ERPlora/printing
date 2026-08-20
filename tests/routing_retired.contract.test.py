#!/usr/bin/env python3
"""The Routing tab is RETIRED, and the module must not grow it back (printing#25).

## What was wrong

The module published a **Routing** tab where the merchant assigned product categories to stations,
and **nobody read the table**. Not "read it badly" — nobody read `printing_routing` at all, and had
not since ADR-0144 moved the kitchen ticket to fire from the ORDER. We had written that down in two
places and never done the work:

  architecture/modules/printing.md:
    ⚠️ `printing.routing.*` y `print_kitchen` están OBSOLETOS desde ADR-0144 … Nadie lee ya la
    tabla `printing_routing`, retirarla (tabla, queries, commands y la vista Routing) es trabajo
    propio.
  hub/apps/web/src/lib/print-on-sale.ts:
    `printing.print_kitchen` y `printing.routing.*` quedan OBSOLETOS: no los lee nadie.

It is the worst kind of dead surface: not hidden, but IN THE NAVIGATION, and documented to the user
as working. A merchant could spend an evening routing Drinks to the bar and nothing whatsoever
would happen at service time.

## Why retiring instead of wiring it up

Because the capability already exists, in the module that owns it. `kitchen` routes an item by
**explicit station → product → category → nothing** (`kitchen_category_station`,
`kitchen.stations.set_routing`, and its own *Stations* screen), and the category of a line reaches
it for real since sales#12 — verified in kitchen#32, which fixed the contract and the docs. So this
was never a missing feature: it was a SECOND, dead copy of a live one, in the wrong module.

Giving `printing_routing` a consumer would mean two places to configure the same thing and only one
of them working — which is how a merchant learns to trust neither. The merchant loses nothing here:
the screen that routes by category is `kitchen` → Stations.

## The table stays

`printing_routing` is NOT dropped, and that is a decision, not an oversight:

  * a `DROP TABLE` in a module migration needs `kind: contract`, and per ADR-0269 a contract
    migration is exactly what makes a version **non-rollbackable** — the rollback story is "revert
    the code, the schema stays";
  * the rows are the merchant's own configuration. Nothing reads them today, but destroying them to
    reclaim a few kilobytes buys nothing and cannot be undone;
  * with no query and no command left, the table is unreachable from anywhere.

So: the doors go, the room stays. This test pins that decision so nobody deletes the table by
reflex later, and so nobody adds the tab back by reflex either.

Usage: tests/routing_retired.contract.test.py   (exit 0 = green). No Postgres, no Docker.
"""

import json
import pathlib
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())

COMPONENT = "erp-printing-routing"

# Everything the retired surface used to carry. Each name is checked in the place it lived.
RETIRED_QUERIES = ["printing.routing.list"]
RETIRED_COMMANDS = ["printing.routing.set", "printing.routing.remove"]
RETIRED_PERMISSIONS = ["printing.view_routing", "printing.manage_routing"]
RETIRED_FILES = [
    "queries/routing_list.sql",
    "commands/routing_upsert.sql",
    "commands/routing_delete.sql",
    "schemas/routing_set.json",
    "schemas/routing_remove.json",
    "fixtures/printing.routing.list.json",
    f"ui/components/{COMPONENT}/{COMPONENT}.ts",
    f"ui/components/{COMPONENT}/{COMPONENT}.test.ts",
]
# i18n that only ever labelled that screen. `roleKitchen`/`roleBar` are NOT here: they name the
# PRINTER's role on the Printers screen, which is alive.
RETIRED_I18N = [
    "routingTitle",
    "routingIntro",
    "categoryPlaceholder",
    "stationPlaceholder",
    "assign",
    "stationReceipt",
    "stationKitchen",
    "stationBar",
    "colCategory",
    "colStation",
    "actionEdit",
    "actionDelete",
    "searchRouting",
    "emptyRouting",
    "errSaveRule",
    "errRemoveRule",
]


def check_navigation():
    problems = []
    components = [entry.get("component") for entry in MANIFEST.get("navigation", [])]
    if COMPONENT in components:
        problems.append(
            f"`{COMPONENT}` is still in `navigation[]`: the merchant is being offered a screen "
            "whose rules nothing applies. Routing by category lives in `kitchen` → Stations "
            "(kitchen#32, sales#12)"
        )
    if "routing" in (
        MANIFEST.get("navigation")
        and [e.get("id") for e in MANIFEST["navigation"]]
        or []
    ):
        problems.append("the `routing` navigation entry is still declared")
    return problems


def check_manifest_surface():
    problems = []
    for name in RETIRED_QUERIES:
        if name in MANIFEST.get("queries", {}):
            problems.append(
                f"query `{name}` is still declared and nothing reads its table"
            )
    for name in RETIRED_COMMANDS:
        if name in MANIFEST.get("commands", {}):
            problems.append(
                f"command `{name}` is still declared and writes a table nobody reads"
            )
    declared = set(MANIFEST.get("permissions", []))
    for permission in RETIRED_PERMISSIONS:
        if permission in declared:
            problems.append(f"`{permission}` is still declared: it gates nothing")
        for role, granted in MANIFEST.get("role_permissions", {}).items():
            if permission in granted:
                problems.append(f"role `{role}` is still granted `{permission}`")
    return problems


def check_files_are_gone():
    return [
        f"`{rel}` is still in the package: it belongs to the retired Routing screen"
        for rel in RETIRED_FILES
        if (MODULE_DIR / rel).exists()
    ]


def load_locale(lang):
    return json.loads((MODULE_DIR / f"locales/{lang}.json").read_text())


def check_i18n():
    problems = []
    for lang in ("en", "es"):
        catalog = load_locale(lang)
        ui = catalog.get("ui", {})
        for key in RETIRED_I18N:
            if key in ui:
                problems.append(
                    f"`{lang}.json` still carries `ui.{key}`, a label of a dead screen"
                )
        if "routing" in catalog.get("navigation", {}):
            problems.append(f"`{lang}.json` still carries `navigation.routing`")
    # English is the source and Spanish is its translation (ADR-0055/0199): retiring keys from one
    # and not the other is how a catalog drifts.
    en_ui = set(load_locale("en").get("ui", {}))
    es_ui = set(load_locale("es").get("ui", {}))
    if en_ui != es_ui:
        problems.append(
            "the two catalogs no longer declare the same `ui` keys — "
            f"only in en: {sorted(en_ui - es_ui)}; only in es: {sorted(es_ui - en_ui)}"
        )
    return problems


def check_the_table_is_kept_on_purpose():
    """The room stays even though the doors are gone — and it says so, where it is created."""
    problems = []
    init = (MODULE_DIR / "migrations/postgres/001_init.sql").read_text()
    if "CREATE TABLE IF NOT EXISTS printing_routing" not in init:
        problems.append(
            "001_init.sql no longer creates `printing_routing`. Rewriting an applied migration "
            "does NOT drop the table where it already exists (`_hub_migrations` records by "
            "FILENAME) and it does break the hubs where it does not — see the header of that file"
        )
    for migration in sorted((MODULE_DIR / "migrations/postgres").glob("*.sql")):
        body = migration.read_text().upper()
        if "DROP TABLE" in body and "PRINTING_ROUTING" in body:
            problems.append(
                f"{migration.name} drops `printing_routing`. That needs `kind: contract`, and per "
                "ADR-0269 a contract migration is what makes a version non-rollbackable — for a "
                "table nothing can reach any more. The decision is to KEEP it: read the header of "
                "this test before changing it"
            )
    return problems


def check_the_check_reaches_something():
    problems = []
    if not MANIFEST.get("navigation"):
        problems.append(
            "the manifest declares no navigation at all: this gate lost its subject"
        )
    if not load_locale("en").get("ui"):
        problems.append(
            "the English catalog is empty: the i18n checks would pass on nothing"
        )
    return problems


def main():
    problems = []
    problems += check_the_check_reaches_something()
    problems += check_navigation()
    problems += check_manifest_surface()
    problems += check_files_are_gone()
    problems += check_i18n()
    problems += check_the_table_is_kept_on_purpose()

    for problem in problems:
        print(f"FAIL  {problem}")
    if problems:
        print(f"\n{len(problems)} remnant(s) of the retired Routing surface")
        return 1

    print(
        "OK: the Routing tab, its query, its two commands, its two permissions, its files and its "
        f"{len(RETIRED_I18N)} i18n keys are gone; `printing_routing` is kept on purpose and "
        "unreachable"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
