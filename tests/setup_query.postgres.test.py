#!/usr/bin/env python3
"""Setup-item contract test (printing#9) — runs against a REAL Postgres 18 in Docker.

`module.json` declares an onboarding checklist item (`setup`, hub#369 / ADR-0222): the runtime runs
`setup.query`, takes the FIRST row and ticks the item when every `configured_when` check passes.
`tests/manifest.contract.test.py` proves the block is well formed; this one proves it is TRUE — that
the query really answers the question the item asks, against real SQL and real rows.

What the item claims for this module, and why it is not "there are settings":

  * The printer ROLE is not ours to check. Which physical printer is the `receipt` one lives in the
    device (`erplora_set_device_role`, the bridge's `devices.json`) and moves to the CORE with the
    print queue of ADR-0196 (hub#341-344) — never into a `printing_*` table. A `setup.query` has to
    be a query of the module ITSELF, so "≥1 printer with the receipt role" is a question this
    manifest cannot ask. What it can ask is whether the receipt this hub would print is set up.
  * "A row exists" would be a false DONE. `printing_settings` is a singleton written by the first
    save on the Printers screen, defaults and all, so a blank Save — or a blueprint import — would
    tick the item with nothing configured. A false "done" hides the task forever; a false "pending"
    at least stays visible.
  * The header is the one field with no usable default. `receipt_header` is what the shell prints
    as the business name on the ticket, and it falls back to the literal string `ERPlora` when it is
    empty (`hub/apps/web/src/lib/print-on-sale.ts`, `buildReceipt`). Empty header = the customer
    gets a receipt with the software vendor's name on it. That is the defect the item exists to
    prevent, and it is the module's own data.

Everything that can still go wrong here is SQL semantics, which is why it needs a database:

  * The declared column has to come back. A `configured_when` field the query does not return is not
    an error on the hub, it is a missing value — and a missing value reads as "not configured"
    forever, so the checklist would nag about a receipt that is already set up.
  * A brand-new hub has no `printing_settings` row at all, and that has to read as pending. Since
    printing#42 the query answers ONE row even then — the table's defaults, so the till prints what
    the screen shows — and that row carries an empty header, which is exactly what keeps it pending.
  * Soft-delete and `hub_id` scoping are part of the row contract (§2.5). A deleted row, or another
    hub's row, must not tick this hub's item.

The truthiness rule is not this file's invention: it mirrors `truthy()` in
`hub/crates/runtime/src/setup_status.rs` — null, `""`, `0`, `false` and the STRINGS `"0"`/`"false"`
are all empty, and a string is trimmed before being judged.

Usage: tests/setup_query.postgres.test.py
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
DB = f"printing_setup_test_{os.getpid()}"
HUB = "hub-test"
OTHER_HUB = "hub-somebody-else"

MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())

failures: list[str] = []


# ── Postgres plumbing ────────────────────────────────────────────────────────────────────


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
    """Single pass over the `:name` placeholders. Params the caller does not supply bind as NULL,
    which is what the runtime's driver does (`DynNull`, crates/db/src/lib.rs)."""
    return PARAM.sub(lambda m: literal(params.get(m.group(1))), sql)


def run_setup_query(setup: dict, hub: str = HUB) -> list[dict]:
    """Run `setup.query` the way the runtime does: the query's own SQL, `:hub_id` injected, plus
    whatever static `params` the manifest declares. Rows come back as dicts."""
    qdef = (MANIFEST.get("queries") or {}).get(setup["query"])
    if qdef is None:
        failures.append(f"setup.query: `{setup['query']}` is not declared in `queries`")
        return []
    sql = (MODULE_DIR / qdef["sql"]).read_text().strip().rstrip(";")
    params = {"hub_id": hub, **(setup.get("params") or {})}
    try:
        out = psql(
            ["-tAc", f"SELECT row_to_json(r) FROM ({bind(sql, params)}) r"], db=DB
        )
    except RuntimeError as exc:
        failures.append(
            f"setup.query: `{setup['query']}` failed to run: {str(exc).splitlines()[0]}"
        )
        return []
    return [json.loads(line) for line in out.splitlines() if line.strip()]


# ── The runtime's verdict, in miniature (`setup_status.rs`) ──────────────────────────────


FALSY_TEXT = {"", "0", "false"}


def truthy(value) -> bool:
    if value is None or value is False:
        return False
    if value is True:
        return True
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() not in FALSY_TEXT


def is_configured(rows: list[dict], checks: list[dict]) -> bool:
    """Configured ⇔ there IS a row and EVERY check passes (ADR-0063). A check that declares neither
    `truthy` nor `equals` never passes: a half-written contract must not tick the item as done."""
    if not rows:
        return False
    row = rows[0]
    for check in checks:
        value = row.get(check["field"])
        if "truthy" in check:
            if truthy(value) != check["truthy"]:
                return False
        elif "equals" in check:
            if str(value) != str(check["equals"]):
                return False
        else:
            return False
    return True


# ── Fixtures ─────────────────────────────────────────────────────────────────────────────


def save_settings(sid: str = "s1", hub: str = HUB, **overrides) -> None:
    """The singleton as the Printers screen writes it: only what the form sends, everything else on
    the DDL default. That is the whole point — the defaults must not be enough."""
    columns = {
        "id": sid,
        "hub_id": hub,
        "is_deleted": 0,
        "created_at": "2026-08-07T09:00:00+00:00",
        "updated_at": "2026-08-07T09:00:00+00:00",
        **overrides,
    }
    cols = ", ".join(columns)
    values = ", ".join(literal(v) for v in columns.values())
    psql(["-c", f"INSERT INTO printing_settings ({cols}) VALUES ({values})"], db=DB)


def clear_settings() -> None:
    psql(["-c", "DELETE FROM printing_settings"], db=DB)


# ── Assertions ───────────────────────────────────────────────────────────────────────────


def check(label: str, expected, actual) -> None:
    if expected != actual:
        failures.append(f"{label} — expected [{expected}], got [{actual}]")
        print(f"  FAIL: {label} — expected [{expected}], got [{actual}]")
    else:
        print(f"  ok: {label} = {expected}")


# ── The run ──────────────────────────────────────────────────────────────────────────────


def apply_migrations() -> None:
    for rel in (MANIFEST.get("migrations") or {}).get("postgres", []):
        psql([], db=DB, stdin=(MODULE_DIR / rel).read_text())


def run() -> None:
    setup = MANIFEST.get("setup")
    if not isinstance(setup, dict):
        failures.append(
            "setup: `module.json` declares no `setup` block, so this module contributes no item to "
            "`hub.setup.status` and a brand-new hub is never told that nobody has set up the "
            "receipt it prints (printing#9)"
        )
        return

    checks = setup.get("configured_when") or []
    fields = [c.get("field") for c in checks if isinstance(c, dict)]
    apply_migrations()

    # 1. A brand-new hub: nobody has opened the Printers screen, so there is no singleton at all.
    #    The query has to RUN (an error would drop the item entirely, §5 best-effort). Since
    #    printing#42 it answers ONE row with the table's defaults (so the till's print-on-sale reads
    #    the same settings the screen shows), and that row's header is empty — so the item is still
    #    pending. This is day one of every hub.
    rows = run_setup_query(setup)
    check("a hub that never saved printing settings answers one row", 1, len(rows))
    check(
        "…whose header is the empty default",
        "",
        rows[0].get("receipt_header") if rows else None,
    )
    check("a hub that never saved is NOT configured", False, is_configured(rows, checks))

    # 2. The regression this item is for: the screen saved with its defaults. The row exists — so
    #    "there are settings" would tick — but the header is `''`, and an empty header makes the
    #    shell print `ERPlora` as the business name on the customer's receipt.
    save_settings()
    rows = run_setup_query(setup)
    check("a saved settings row comes back as exactly one row", 1, len(rows))
    if rows:
        for name in fields:
            check(f"`{name}` is a column the query returns", True, name in rows[0])
    check(
        "settings saved with their defaults do NOT configure the item",
        False,
        is_configured(rows, checks),
    )

    # 3. The business puts its own details on the ticket: that is the item done.
    clear_settings()
    save_settings(receipt_header="Bar Manolo · B12345678 · C/ Mayor 1")
    check(
        "a receipt that carries the business details configures the item",
        True,
        is_configured(run_setup_query(setup), checks),
    )

    # 4. Blank space is not a header. The runtime trims before judging, so a spacebar in the field
    #    must not buy a tick the printed ticket does not deliver.
    clear_settings()
    save_settings(receipt_header="   ")
    check(
        "a whitespace-only header does NOT configure the item",
        False,
        is_configured(run_setup_query(setup), checks),
    )

    # 5. Soft-delete is part of the row contract: a deleted singleton is not a configured hub, and
    #    the item is state, not a milestone — it goes back to pending.
    clear_settings()
    save_settings(
        receipt_header="Bar Manolo",
        is_deleted=1,
        deleted_at="2026-08-07T10:00:00+00:00",
    )
    check(
        "a soft-deleted settings row goes back to pending",
        False,
        is_configured(run_setup_query(setup), checks),
    )

    # 6. And it is scoped to the hub asking. The runtime injects `:hub_id`; a neighbour's receipt
    #    setup must never tick this hub's checklist.
    clear_settings()
    save_settings(hub=OTHER_HUB, receipt_header="Somebody Else SL")
    check(
        "another hub's settings do not configure this one",
        False,
        is_configured(run_setup_query(setup), checks),
    )
    check(
        "…while that other hub reads as configured",
        True,
        is_configured(run_setup_query(setup, hub=OTHER_HUB), checks),
    )


def main() -> int:
    try:
        psql(["-c", f'DROP DATABASE IF EXISTS "{DB}"'])
        psql(["-c", f'CREATE DATABASE "{DB}"'])
    except RuntimeError as exc:
        print(f"SKIPPED — no Postgres at `{CONTAINER}`: {str(exc).splitlines()[0]}")
        print(
            "  (docker start erplora-test-pg-5433, or set PRINTING_TEST_PG_CONTAINER)"
        )
        return 0

    try:
        run()
    finally:
        psql(["-c", f'DROP DATABASE IF EXISTS "{DB}" WITH (FORCE)'])

    print()
    if failures:
        print(f"FAILED — {len(failures)} broken promise(s) in the `setup` item:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PASS — the setup query answers the question the checklist item asks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
