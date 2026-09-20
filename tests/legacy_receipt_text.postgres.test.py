#!/usr/bin/env python3
"""The receipt text is not this module's any more — and what a shop typed here still SURVIVES
(printing#44). Runs against a REAL Postgres 18 in Docker.

Until hub#1921 the ticket that came out on its own at checkout was built by the shell from
`printing.settings.get` → `receipt_header`/`receipt_footer`. Since then BOTH papers — the automatic
one and the one the print button sends — are the sales viewer's document, which reads
`sales.pos_settings.get`. So the two boxes on the Printers screen wrote a field NO paper reads: the
owner typed their branding, pressed Save, got a success and their ticket kept coming out under the
legal name.

This battery replaces `tests/setup_query.postgres.test.py`, whose premise died with hub#1921: it
proved that the onboarding item ticked when `receipt_header` was filled in, which is exactly the
lie being removed here.

What it pins, in the order it matters:

  1. 🪦 NO `setup` BLOCK. This module no longer contributes an item to `hub.setup.status`, and that
     is a decision, not an omission. The item measured `receipt_header`, so it asked a brand-new
     salon for a field its ticket does not use and kept «Your printer» pending until it was typed.
     What the step really needs — a printer carrying the `receipt` role — lives in the CORE's device
     registry (`erplora_set_device_role` → the print queue of ADR-0196), never in a `printing_*`
     table, and a `setup.query` has to be a query of the module ITSELF. There is nothing honest left
     for this manifest to measure: every other column it stores has a working default, so any check
     over them would tick on day one. A false «done» hides the task for good; the core item that CAN
     see the printers is ERPlora/hub#1948.

  2. THE TEXT SURVIVES. `printing.settings.update` no longer writes the two columns, so what a shop
     typed before hub#1921 is still there to be moved into the till settings. A save that blanked
     them would destroy the text in the very release that offers to rescue it — and with the value
     bound from a payload that no longer carries it, that is exactly what the old statement did
     (`:receipt_header` → NULL on a NOT NULL column, or `''` where the driver coerces).

  3. AND IT SURVIVES A PAYLOAD THAT CARRIES IT. The schema stopped declaring the two fields, but
     `additionalProperties` is open and older screens, integrations and the assistant all send
     snapshots: the statement, not the schema, is what has to refuse to write them.

  4. THE SCREEN CAN STILL READ IT. `printing.settings.get` keeps projecting both columns — that is
     the one reader left, and it is what lets the Printers screen offer the move
     (`sales.settings.adopt_receipt_text`).

  5. TENANCY AND SOFT-DELETE, because they are the row contract and a legacy column is still a row.

Usage: tests/legacy_receipt_text.postgres.test.py
  Uses the `erplora-test-pg-5433` container by default (override: PRINTING_TEST_PG_CONTAINER).
  Creates a scratch database and DROPS it at the end, pass or fail.
"""

import json
import os
import pathlib
import re
import subprocess
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
CONTAINER = os.environ.get("PRINTING_TEST_PG_CONTAINER", "erplora-test-pg-5433")
DB = f"printing_legacy_receipt_text_{os.getpid()}"
HUB = "hub-test"
OTHER_HUB = "hub-somebody-else"

MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())
QUERY = "printing.settings.get"
COMMAND = "printing.settings.update"
LEGACY_COLUMNS = ("receipt_header", "receipt_footer")

# What the Printers screen still owns and sends on every save.
OWNED = {
    "paper_width": 58,
    "auto_print_on_sale": 0,
    "open_drawer_on_sale": 1,
    "print_kitchen": 0,
}

STRANDED_HEADER = "Bar Manolo\nC/ Mayor 1"
STRANDED_FOOTER = "Gracias por su visita"

failures: list[str] = []
checks_made = 0


# ── Postgres plumbing ────────────────────────────────────────────────────────────────────


def psql(args: list[str], db: str | None = None, stdin: str | None = None) -> str:
    cmd = ["docker", "exec", "-i", CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres"]
    if db:
        cmd += ["-d", db]
    cmd += args
    res = subprocess.run(cmd, input=stdin, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip() or res.stdout.strip())
    return res.stdout


PARAM = re.compile(r":([a-z_][a-z0-9_]*)", re.IGNORECASE)


def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def bind(sql: str, params: dict) -> str:
    """Single pass over the `:name` placeholders. What the caller does not supply binds NULL, which
    is what the runtime's driver does (`DynNull`, crates/db/src/lib.rs) — and the whole point of
    §2: a statement that still named `:receipt_header` would write that NULL."""
    return PARAM.sub(lambda m: literal(params.get(m.group(1))), sql)


def run_command(new_id: str, hub: str = HUB, **payload) -> None:
    spec = MANIFEST["commands"][COMMAND]
    files = spec["sql"] if isinstance(spec["sql"], list) else [spec["sql"]]
    system = {"hub_id": hub, "new_id": new_id, "current_user_id": "u1", "now": "2026-09-20T09:00:00+00:00"}
    body = ["BEGIN;"]
    for rel in files:
        body.append(bind((MODULE_DIR / rel).read_text(), {**system, **payload}))
    body.append("COMMIT;")
    psql([], db=DB, stdin="\n".join(body) + "\n")


def settings_get(hub: str = HUB) -> list[dict]:
    sql = (MODULE_DIR / MANIFEST["queries"][QUERY]["sql"]).read_text().strip().rstrip(";")
    out = psql(["-tAc", f"SELECT row_to_json(r) FROM ({bind(sql, {'hub_id': hub})}) r"], db=DB)
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def store_stranded_text(row_id: str = "s1", hub: str = HUB) -> None:
    """The row a shop left behind before hub#1921: text in the legacy columns, written by the screen
    of the day."""
    psql(
        [
            "-c",
            "INSERT INTO printing_settings (id, hub_id, receipt_header, receipt_footer, is_deleted, created_at, updated_at) "
            f"VALUES ({literal(row_id)}, {literal(hub)}, {literal(STRANDED_HEADER)}, {literal(STRANDED_FOOTER)}, 0, "
            "'2026-08-01T00:00:00+00:00', '2026-08-01T00:00:00+00:00')",
        ],
        db=DB,
    )


def check(label: str, expected, actual) -> None:
    global checks_made
    checks_made += 1
    if expected != actual:
        failures.append(f"{label} — expected [{expected}], got [{actual}]")
        print(f"  FAIL: {label} — expected [{expected}], got [{actual}]")
    else:
        print(f"  ok: {label}")


def apply_migrations() -> None:
    # `erplora test` publishes the resolved paths, one per line, so a manifest entry in its object
    # form (`{ file, kind, since }`, hub#542) does not kill the battery before it proves anything
    # (module-toolkit#180). Run by hand, the manifest is read the same way, entry by entry.
    published = os.environ.get("ERPLORA_MIGRATION_FILES")
    entries = (
        [line for line in published.splitlines() if line.strip()]
        if published
        else [
            entry if isinstance(entry, str) else entry["file"]
            for entry in (MANIFEST.get("migrations") or {}).get("postgres", [])
        ]
    )
    for rel in entries:
        psql([], db=DB, stdin=(MODULE_DIR / rel).read_text())


# ── The run ──────────────────────────────────────────────────────────────────────────────


def run() -> None:
    print("\n1 · NO CHECKLIST ITEM — the manifest stopped asking for a field no paper reads")
    check(
        "`module.json` declares no `setup` block (the item measured `receipt_header`)",
        None,
        MANIFEST.get("setup"),
    )
    schema = json.loads((MODULE_DIR / MANIFEST["commands"][COMMAND]["schema"]).read_text())
    for column in LEGACY_COLUMNS:
        check(
            f"the update door no longer declares `{column}`",
            False,
            column in (schema.get("properties") or {}) or column in (schema.get("required") or []),
        )

    apply_migrations()

    print("\n2 · THE TEXT SURVIVES A SAVE — it is what the move has left to rescue")
    store_stranded_text()
    run_command("s2", **OWNED)
    rows = settings_get()
    check("the save landed on what this screen owns", 58, rows[0].get("paper_width") if rows else None)
    check("…and on the switch beside it", 1, rows[0].get("open_drawer_on_sale") if rows else None)
    check("the stranded header is untouched", STRANDED_HEADER, rows[0].get("receipt_header") if rows else None)
    check("the stranded footer is untouched", STRANDED_FOOTER, rows[0].get("receipt_footer") if rows else None)

    print("\n3 · A PAYLOAD THAT STILL CARRIES THE TEXT WRITES NOTHING")
    run_command("s3", receipt_header="Plantilla Demo", receipt_footer="Otro pie", **OWNED)
    rows = settings_get()
    check("the header sent by an older caller is ignored", STRANDED_HEADER, rows[0].get("receipt_header") if rows else None)
    check("…and so is the footer", STRANDED_FOOTER, rows[0].get("receipt_footer") if rows else None)

    print("\n4 · THE SCREEN CAN STILL READ IT — the one reader left is the move it offers")
    for column in LEGACY_COLUMNS:
        check(f"`{QUERY}` still projects `{column}`", True, column in (rows[0] if rows else {}))
    psql(["-c", "DELETE FROM printing_settings"], db=DB)
    rows = settings_get()
    check("a hub that never saved still answers exactly one row", 1, len(rows))
    check("…with no text to rescue", ("", ""), (rows[0].get("receipt_header"), rows[0].get("receipt_footer")) if rows else None)

    print("\n5 · THE ROW CONTRACT — a legacy column is still a row")
    store_stranded_text("s4", OTHER_HUB)
    run_command("s5", **OWNED)
    check(
        "another hub's stranded text is not this hub's",
        ("", ""),
        (settings_get()[0].get("receipt_header"), settings_get()[0].get("receipt_footer")),
    )
    check(
        "…and the neighbour keeps its own",
        (STRANDED_HEADER, STRANDED_FOOTER),
        (settings_get(OTHER_HUB)[0].get("receipt_header"), settings_get(OTHER_HUB)[0].get("receipt_footer")),
    )
    psql(
        [
            "-c",
            f"UPDATE printing_settings SET is_deleted = 1, deleted_at = '2026-09-20T10:00:00+00:00' WHERE hub_id = {literal(OTHER_HUB)}",
        ],
        db=DB,
    )
    check(
        "a soft-deleted singleton hands back no text to move",
        ("", ""),
        (settings_get(OTHER_HUB)[0].get("receipt_header"), settings_get(OTHER_HUB)[0].get("receipt_footer")),
    )


def main() -> int:
    try:
        psql(["-c", f'DROP DATABASE IF EXISTS "{DB}" WITH (FORCE)'])
        psql(["-c", f'CREATE DATABASE "{DB}"'])
    except RuntimeError as exc:
        print(f"SKIPPED — no Postgres at `{CONTAINER}`: {str(exc).splitlines()[0]}")
        print("  (docker start erplora-test-pg-5433, or set PRINTING_TEST_PG_CONTAINER)")
        return 0

    try:
        run()
    finally:
        psql(["-c", f'DROP DATABASE IF EXISTS "{DB}" WITH (FORCE)'])

    print()
    # A run that asserted nothing passes every check it did not make: the positive control.
    if checks_made < 15:
        failures.append(f"only {checks_made} checks ran — this battery inspected almost nothing")
    if failures:
        print(f"FAILED — {len(failures)} broken promise(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PASS — the receipt text is no longer this module's to write, and what was typed here survives")
    return 0


if __name__ == "__main__":
    sys.exit(main())
