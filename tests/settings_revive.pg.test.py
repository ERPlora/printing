#!/usr/bin/env python3
"""Saving the printing settings has to RESURRECT a soft-deleted singleton (printing#25, 2nd finding).

## The trap

`printing_settings` is a singleton per hub, and `uq_printing_settings_hub` is a **plain** unique
index over `hub_id` — not a partial one. So a row with `is_deleted = 1` keeps occupying the
`ON CONFLICT` slot: the upsert of `printing.settings.update` finds it, takes the `DO UPDATE` branch,
writes every field… and leaves `is_deleted` at 1.

`queries/settings_get.sql` filters `is_deleted = 0`, so the row that was just written is invisible.
The merchant sets the paper width, presses Save, gets a success, reloads and finds the form back on
the defaults — with no way out of the state from inside the product, however many times Save is
pressed.

(The witness used to be `receipt_header`. Since printing#44 this door does not write it — the
receipt text is the till's, `sales.pos_settings.get` — so what is round-tripped here is what the
door still owns: the paper width and the two switches.)

Its twin `commands/routing_upsert.sql` already revived (`is_deleted = 0, deleted_at = NULL`) in its
`DO UPDATE`. This one did not, and the difference was not a decision — it was an omission.

Not P1 because no command of this module soft-deletes the singleton today, so the state is only
reachable through an import, a reset or maintenance. It is a one-way trap all the same: once in it,
nothing in the product gets you out.

## What is asserted

1. A soft-deleted singleton + `settings.update` → the row comes back ALIVE, with what was saved,
   and `settings.get` returns it.
2. The ordinary paths do not change: first save inserts, second save updates, and neither touches
   another hub's row.

Everything runs against a real Postgres built from this module's own migrations, binding `:name`
the way the runtime does. Zero mocks.

Usage: tests/settings_revive.pg.test.py   (exit 0 = green)
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
import uuid

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())
CONTAINER = os.environ.get("PRINTING_TEST_PG_CONTAINER", "erplora-test-pg-5433")

HUB = "hub-test"
OTHER_HUB = "hub-somebody-else"

COMMAND = "printing.settings.update"
QUERY = "printing.settings.get"

PARAM = re.compile(r":([a-z_][a-z0-9_]*)", re.IGNORECASE)


def psql(db, args, stdin=None):
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


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def bind(sql, params):
    """One pass over `:name`. What the caller does not supply binds NULL, like the runtime's driver."""
    return PARAM.sub(lambda m: literal(params.get(m.group(1))), sql)


def docker_available():
    try:
        r = subprocess.run(
            ["docker", "exec", CONTAINER, "pg_isready", "-U", "postgres"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return r.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def run_command(db, hub, new_id, now, **payload):
    """Runs every statement of the command in order, in one transaction, like the runtime does."""
    spec = MANIFEST["commands"][COMMAND]
    files = spec["sql"] if isinstance(spec["sql"], list) else [spec["sql"]]
    system = {"hub_id": hub, "new_id": new_id, "current_user_id": "u1", "now": now}
    body = ["BEGIN;"]
    for rel in files:
        sql = (MODULE_DIR / rel).read_text()
        body.append(bind(sql, {**system, **payload}))
    body.append("COMMIT;")
    psql(db, [], stdin="\n".join(body) + "\n")


def settings_get(db, hub=HUB):
    """The read the screen and the checklist item both use."""
    sql = (
        (MODULE_DIR / MANIFEST["queries"][QUERY]["sql"]).read_text().strip().rstrip(";")
    )
    out = psql(
        db, ["-tAc", f"SELECT row_to_json(r) FROM ({bind(sql, {'hub_id': hub})}) r"]
    )
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def raw_row(db, hub=HUB):
    out = psql(
        db,
        [
            "-tAc",
            f"SELECT row_to_json(r) FROM (SELECT * FROM printing_settings WHERE hub_id = {literal(hub)}) r",
        ],
    )
    rows = [json.loads(line) for line in out.splitlines() if line.strip()]
    return rows[0] if rows else None


PAYLOAD = {
    "paper_width": 80,
    "auto_print_on_sale": 1,
    "open_drawer_on_sale": 0,
    "print_kitchen": 0,
}


def check_first_save_inserts(db):
    # 58 mm is the OPPOSITE of the column default: a save that wrote nothing would read as 80 and
    # pass a check made against the default.
    run_command(
        db, HUB, "s1", "2026-08-20T09:00:00+00:00", **{**PAYLOAD, "paper_width": 58}
    )
    rows = settings_get(db)
    if len(rows) != 1 or rows[0]["paper_width"] != 58:
        return [f"the first save did not land: `{QUERY}` answers {rows}"]
    return []


def check_second_save_updates(db):
    run_command(
        db,
        HUB,
        "s2",
        "2026-08-20T09:05:00+00:00",
        **{**PAYLOAD, "paper_width": 58, "auto_print_on_sale": 0},
    )
    rows = settings_get(db)
    if len(rows) != 1:
        return [
            f"the singleton stopped being a singleton: {len(rows)} rows after a second save"
        ]
    if rows[0]["auto_print_on_sale"] != 0:
        return [
            f"the second save did not update: auto-print is {rows[0]['auto_print_on_sale']!r}"
        ]
    return []


def check_soft_deleted_row_is_revived(db):
    """The whole point: Save has to be a way OUT of the soft-deleted state, not a dead end."""
    psql(
        db,
        [
            "-c",
            f"UPDATE printing_settings SET is_deleted = 1, deleted_at = '2026-08-20T09:06:00+00:00' WHERE hub_id = {literal(HUB)}",
        ],
    )
    # Since printing#42 `settings.get` always answers one row (the defaults when nothing live is
    # stored), so "invisible" means the soft-deleted values do not come back — not zero rows.
    if any(r.get("paper_width") == 58 for r in settings_get(db)):
        return [
            "the fixture is wrong: a soft-deleted singleton is still visible to `settings.get`"
        ]

    run_command(
        db,
        HUB,
        "s3",
        "2026-08-20T09:10:00+00:00",
        **{**PAYLOAD, "paper_width": 58, "auto_print_on_sale": 0},
    )

    problems = []
    row = raw_row(db)
    if row is None:
        return ["the row vanished: the upsert wrote nothing at all"]
    if row["is_deleted"] != 0:
        problems.append(
            "saving the settings over a SOFT-DELETED singleton reports success and leaves "
            "`is_deleted = 1`: `settings.get` filters it out, so the form comes back on the "
            "defaults however many times Save is pressed, with no way out from inside the "
            "product. Its twin `routing_upsert.sql` revived — this one has to as well"
        )
    if row.get("deleted_at") is not None:
        problems.append(
            "the revived row keeps its `deleted_at`: a live row that still says when it was "
            "deleted is a row every later audit reads wrong"
        )
    rows = settings_get(db)
    if len(rows) != 1 or rows[0]["paper_width"] != 58:
        problems.append(
            f"`{QUERY}` still does not answer with the saved settings after the save: {rows}"
        )
    return problems


def check_other_hub_untouched(db):
    psql(
        db,
        [
            "-c",
            "INSERT INTO printing_settings (id, hub_id, paper_width, is_deleted, created_at)"
            f" VALUES ('other', {literal(OTHER_HUB)}, 58, 0, '2026-08-01T00:00:00+00:00')",
        ],
    )
    run_command(
        db,
        HUB,
        "s4",
        "2026-08-20T09:20:00+00:00",
        **{**PAYLOAD, "paper_width": 80},
    )
    rows = settings_get(db, OTHER_HUB)
    if len(rows) != 1 or rows[0]["paper_width"] != 58:
        return [f"saving one hub's settings touched another hub's row: {rows}"]
    return []


def main():
    assert COMMAND in MANIFEST["commands"], (
        f"`{COMMAND}` is no longer declared: this gate is stale"
    )
    assert QUERY in MANIFEST["queries"], (
        f"`{QUERY}` is no longer declared: this gate is stale"
    )

    if not docker_available():
        print(f"SKIPPED: no Postgres in container {CONTAINER} (nothing was verified)")
        return 0

    db = f"printing_revive_{uuid.uuid4().hex[:8]}"
    subprocess.run(
        ["docker", "exec", CONTAINER, "createdb", "-U", "postgres", db], check=True
    )
    try:
        for rel in MANIFEST["migrations"]["postgres"]:
            psql(db, [], stdin=(MODULE_DIR / rel).read_text())

        problems = check_first_save_inserts(db)
        if not problems:
            problems += check_second_save_updates(db)
        if not problems:
            problems += check_soft_deleted_row_is_revived(db)
        if not problems:
            problems += check_other_hub_untouched(db)

        for problem in problems:
            print(f"FAIL {COMMAND}\n    {problem}")
        if problems:
            return 1

        print(
            "OK: the printing settings insert, update, and come BACK when the singleton was "
            "soft-deleted — and one hub's save never touches another's"
        )
        return 0
    finally:
        subprocess.run(
            ["docker", "exec", CONTAINER, "dropdb", "-U", "postgres", "--force", db]
        )


if __name__ == "__main__":
    sys.exit(main())
