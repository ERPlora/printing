#!/usr/bin/env python3
"""A hub that never saved its printing settings still HAS printing settings (printing#42).

## The defect

`queries/settings_get.sql` selected FROM `printing_settings`, and that table is a singleton written
by the first Save on the Printers screen. A brand-new hub — every salon built from a blueprint —
has no row until somebody presses Save, so `printing.settings.get` answered `{"data": []}`.

Two readers disagreed about what that means:

  * the Printers screen paints its own defaults over the empty answer, so it shows
    «Print receipt on sale: ON» (`auto_print_on_sale INTEGER NOT NULL DEFAULT 1` in the DDL);
  * the shell's print-on-sale listener (`hub/apps/web/src/lib/print-on-sale.ts`) takes the FIRST
    row, finds none, and returns without printing, queueing or warning anybody.

Measured on the Android QA bench (`salon-lucia-and18`, v1.1.27, 2026-09-19): four sales charged,
no paper, an empty queue, no notice — and the next sale printed only after a blank Save.

## What is asserted

The query answers ONE row whatever the stored state, so the screen and the till read the same
settings:

1. Never saved → exactly one row, and it says what a row born from the table's own DDL defaults
   says (auto-print ON, drawer OFF, 80 mm, empty header/footer). Reading writes nothing.
2. What is stored wins over every default — including a stored 0 over a default 1.
3. A soft-deleted singleton is not settings: it answers the defaults, not its old values.
4. Another hub's row never leaks into this hub's answer (the anchor joins on `:hub_id`).

Everything runs against a real Postgres built from this module's own migrations, binding `:name`
the way the runtime does. Zero mocks.

Usage: tests/settings_defaults.postgres.test.py   (exit 0 = green)
  Uses the `erplora-test-pg-5433` container by default (override: PRINTING_TEST_PG_CONTAINER).
  Creates a scratch database and DROPS it at the end, pass or fail. If Docker or the container is
  missing the check is SKIPPED, never passed.
"""

import json
import os
import pathlib
import re
import subprocess
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())
CONTAINER = os.environ.get("PRINTING_TEST_PG_CONTAINER", "erplora-test-pg-5433")
DB = f"printing_defaults_test_{os.getpid()}"

HUB = "hub-test"
OTHER_HUB = "hub-somebody-else"
DDL_PROBE_HUB = "hub-ddl-probe"

QUERY = "printing.settings.get"
FIELDS = [
    "receipt_header",
    "receipt_footer",
    "paper_width",
    "auto_print_on_sale",
    "open_drawer_on_sale",
    "print_kitchen",
]

PARAM = re.compile(r":([a-z_][a-z0-9_]*)", re.IGNORECASE)

failures: list[str] = []


def psql(args: list[str], db: str | None = None, stdin: str | None = None) -> str:
    cmd = [
        "docker",
        "exec",
        "-i",
        CONTAINER,
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
    ]
    if db:
        cmd += ["-d", db]
    res = subprocess.run(cmd + args, input=stdin, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip() or res.stdout.strip())
    return res.stdout


def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def bind(sql: str, params: dict) -> str:
    """One pass over `:name`. What the caller does not supply binds NULL, like the runtime's driver."""
    return PARAM.sub(lambda m: literal(params.get(m.group(1))), sql)


def rows_of(sql: str) -> list[dict]:
    out = psql(["-tAc", f"SELECT row_to_json(r) FROM ({sql}) r"], db=DB)
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def settings_get(hub: str = HUB) -> list[dict]:
    """The read the Printers screen, the checklist item and the till's print-on-sale all use."""
    sql = (MODULE_DIR / MANIFEST["queries"][QUERY]["sql"]).read_text()
    return rows_of(bind(sql.strip().rstrip(";"), {"hub_id": hub}))


def insert(hub: str, sid: str, **columns) -> None:
    """A stored singleton with only the columns given; everything else takes the DDL default."""
    values = {
        "id": sid,
        "hub_id": hub,
        "created_at": "2026-09-19T08:00:00+00:00",
        **columns,
    }
    cols = ", ".join(values)
    vals = ", ".join(literal(v) for v in values.values())
    psql(["-c", f"INSERT INTO printing_settings ({cols}) VALUES ({vals})"], db=DB)


def stored_count(hub: str = HUB) -> int:
    return int(
        psql(
            [
                "-tAc",
                f"SELECT count(*) FROM printing_settings WHERE hub_id = {literal(hub)}",
            ],
            db=DB,
        ).strip()
    )


def check(label: str, expected, actual) -> None:
    if expected != actual:
        failures.append(f"{label} — expected [{expected}], got [{actual}]")
        print(f"  FAIL: {label} — expected [{expected}], got [{actual}]")
    else:
        print(f"  ok: {label} = {expected}")


def ddl_defaults() -> dict:
    """What the table itself says a hub's settings are when nobody chose anything: a row inserted
    with nothing but its keys, read back raw. Taken from the DDL so the query cannot drift from it."""
    insert(DDL_PROBE_HUB, "ddl-probe")
    rows = rows_of(
        f"SELECT {', '.join(FIELDS)} FROM printing_settings WHERE hub_id = {literal(DDL_PROBE_HUB)}"
    )
    psql(
        [
            "-c",
            f"DELETE FROM printing_settings WHERE hub_id = {literal(DDL_PROBE_HUB)}",
        ],
        db=DB,
    )
    return rows[0]


def answer(rows: list[dict]) -> dict:
    return {name: rows[0].get(name) for name in FIELDS} if rows else {}


def run() -> None:
    for rel in MANIFEST["migrations"]["postgres"]:
        psql([], db=DB, stdin=(MODULE_DIR / rel).read_text())

    defaults = ddl_defaults()
    print(f"  the table's own defaults: {defaults}")

    # 1. Day one of every salon: nobody has pressed Save on the Printers screen.
    print("\nnever saved: settings.get answers ONE row with the table's defaults")
    rows = settings_get()
    check("a hub that never saved gets exactly one row", 1, len(rows))
    check("that row says what the DDL defaults say", defaults, answer(rows))
    check(
        "auto-print on sale is ON, which is what the screen shows and the till must obey",
        1,
        rows[0].get("auto_print_on_sale") if rows else None,
    )
    check("nothing was written by READING", 0, stored_count())

    # 2. What the merchant stored wins — above all a 0 stored over a default 1.
    print("\nsaved: the stored values win over every default")
    insert(
        HUB,
        "s1",
        receipt_header="Salón Lucía · B12345678",
        receipt_footer="Gracias",
        paper_width=58,
        auto_print_on_sale=0,
        open_drawer_on_sale=1,
        print_kitchen=1,
    )
    rows = settings_get()
    check("a hub that saved gets exactly one row", 1, len(rows))
    check(
        "every stored value comes back as stored",
        {
            "receipt_header": "Salón Lucía · B12345678",
            "receipt_footer": "Gracias",
            "paper_width": 58,
            "auto_print_on_sale": 0,
            "open_drawer_on_sale": 1,
            "print_kitchen": 1,
        },
        answer(rows),
    )
    check("the stored row keeps its id", "s1", rows[0].get("id") if rows else None)

    # 3. A soft-deleted singleton is no settings at all: defaults, not its old values.
    print("\nsoft-deleted: the old values do not come back")
    psql(
        [
            "-c",
            "UPDATE printing_settings SET is_deleted = 1, deleted_at = '2026-09-19T09:00:00+00:00'"
            f" WHERE hub_id = {literal(HUB)}",
        ],
        db=DB,
    )
    rows = settings_get()
    check("a soft-deleted singleton still answers exactly one row", 1, len(rows))
    check("…and that row is the table's defaults", defaults, answer(rows))
    psql(["-c", f"DELETE FROM printing_settings WHERE hub_id = {literal(HUB)}"], db=DB)

    # 4. The anchor joins on THIS hub: a neighbour's settings never answer for it.
    print("\nanother hub's row does not leak")
    insert(
        OTHER_HUB,
        "other",
        receipt_header="Otro negocio",
        auto_print_on_sale=0,
        paper_width=58,
    )
    rows = settings_get()
    check("this hub still gets exactly one row", 1, len(rows))
    check("…with its own defaults, not the neighbour's values", defaults, answer(rows))
    check(
        "…while the neighbour reads its own",
        "Otro negocio",
        (settings_get(OTHER_HUB) or [{}])[0].get("receipt_header"),
    )


def main() -> int:
    assert QUERY in MANIFEST["queries"], (
        f"`{QUERY}` is no longer declared: this gate is stale"
    )
    try:
        psql(["-c", f'DROP DATABASE IF EXISTS "{DB}"'])
        psql(["-c", f'CREATE DATABASE "{DB}"'])
    except (OSError, RuntimeError) as exc:
        print(
            f"SKIPPED — no Postgres at `{CONTAINER}` (nothing was verified): {str(exc).splitlines()[0]}"
        )
        return 0

    try:
        run()
    finally:
        psql(["-c", f'DROP DATABASE IF EXISTS "{DB}" WITH (FORCE)'])

    print()
    if failures:
        print(f"FAILED — {len(failures)} broken promise(s) of `{QUERY}`:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        f"PASS — `{QUERY}` answers one row: the stored settings, or the table's defaults"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
