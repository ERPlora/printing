#!/usr/bin/env python3
"""`printing.jobs.create` — the module's public door to the hub's print queue (printing#18).

Until this command existed, `printing` published NOTHING outwards: no command any other module or
flow could call to put paper out, and no event. hub#957 opened the door in the runtime (hub#992,
ADR-0349): a module command **emits `<module>.print.due`** with the intention
`{jobId, role?, documentType, document, format?}`, the outbox relay delivers it to the synthetic
listener-host `host.print`, which — after checking the emitting module declares AND was granted
the `printer` capability — calls `print_queue::enqueue` (idempotent by `jobId`, `ON CONFLICT DO
NOTHING`). A flow prints through its `command` step; the flow language itself does not change
(ADR-0283 D1).

What this file pins, and why each check is a check:

  1. THE COMMAND IS DECLARED with the shape the runtime needs: `printing.print` permission (the one
     that already means «this user may print»), a JSON Schema for the payload, at least one SQL
     statement (a Tier-0 command with no SQL and no handler is `NotImplemented` in
     `commands.rs`), and `emit: ["printing.print.due"]` — the ONLY way a declarative command
     reaches the listener-host.
  2. THE EVENT IS DECLARED in `events.emits`. `commands.rs::validate_handler_event` rule 1/4: what
     is not declared is either rejected (strict mode) or invisible to the flow editor (hub#709).
     Declaring the catalogue BEFORE anybody emits is the order the rule imposes.
  3. THE CAPABILITY IS DECLARED: `capabilities.printer`. `deliver_host_print` runs
     `capabilities::require(Printer)` = declared + granted, default-deny. Without the declaration
     no owner can ever grant it, and every job would die in the dead-letter with `host.print:
     capability_denied`.
  4. THE PAYLOAD SCHEMA matches `PrintIntent` (`crates/runtime/src/host_print.rs`): camelCase keys,
     `jobId`/`documentType`/`document` required, `documentType` limited to the queue's closed
     vocabulary (`print_queue::DOCUMENT_TYPES`) so a typo is refused at the door and not eight
     retries later, `role` optional (hub#987: the hub resolves the station), `format` optional.
  5. NOT DECLARED (on purpose): `printing.job.printed` / `printing.job.failed`. Nobody emits them
     yet — the outcome of a job is known by the runtime (`print_ws.rs`/`print_drain.rs`), which has
     no bridge into this module's events. An event that appears in the flow editor and never fires
     is a flow that never runs; they arrive when the hub emits them.
  6. AGAINST A REAL POSTGRES (when `erplora-test-pg-5433` is up): the command's SQL runs on the
     module's own migrations, keeps a per-hub record keyed by `jobId`, and a second call with the
     same `jobId` does not fail (dedup lives in the queue; the ledger must not turn a harmless
     replay into a command error).

Usage: tests/jobs_create.contract.test.py   (exit 0 = green; the Postgres layer reports SKIPPED
       when the container is not reachable, never a pass)
"""

import json
import os
import pathlib
import re
import subprocess
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())

COMMAND = "printing.jobs.create"
EVENT = "printing.print.due"
CAPABILITY = "printer"
PERMISSION = "printing.print"

# `print_queue::DOCUMENT_TYPES` in hub/crates/runtime/src/print_queue.rs — the closed vocabulary
# the queue accepts. Mirrored here so a payload the queue would refuse is refused by the schema.
DOCUMENT_TYPES = [
    "receipt",
    "kitchen_order",
    "invoice",
    "delivery_note",
    "barcode_label",
    "cash_session_report",
    "prebill",
    "generic",
]
# `print_queue::FORMAT_RECEIPT` / `FORMAT_A4`.
FORMATS = ["receipt", "a4"]

CONTAINER = os.environ.get("PRINTING_TEST_PG_CONTAINER", "erplora-test-pg-5433")
DB = f"printing_jobs_test_{os.getpid()}"
HUB = "hub-test"
OTHER_HUB = "hub-somebody-else"

failures: list[str] = []
notes: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    if not ok:
        failures.append(f"{label}{': ' + detail if detail else ''}")


# ── 1–5: the manifest surface ────────────────────────────────────────────────────────────


def check_manifest() -> dict | None:
    cmd = (MANIFEST.get("commands") or {}).get(COMMAND)
    check(
        f"commands.{COMMAND}",
        isinstance(cmd, dict),
        "not declared — printing publishes no door to the print queue",
    )
    if not isinstance(cmd, dict):
        return None
    check(
        f"commands.{COMMAND}.permission",
        cmd.get("permission") == PERMISSION,
        f"got {cmd.get('permission')!r}, expected {PERMISSION!r}",
    )
    check(
        f"commands.{COMMAND}.sql",
        isinstance(cmd.get("sql"), list) and len(cmd["sql"]) >= 1,
        "a Tier-0 command with no SQL is NotImplemented in the runtime",
    )
    check(
        f"commands.{COMMAND}.emit",
        cmd.get("emit") == [EVENT],
        f"got {cmd.get('emit')!r} — the listener-host only sees `*.print.due`",
    )
    check(
        f"commands.{COMMAND}.schema",
        isinstance(cmd.get("schema"), str),
        "the payload has to be validated at the door",
    )
    check(
        f"commands.{COMMAND}.handler",
        "handler" not in cmd,
        "no WASM needed: the emit of a declarative command carries the payload to the outbox",
    )

    emits = (MANIFEST.get("events") or {}).get("emits") or []
    check(
        "events.emits",
        EVENT in emits,
        f"`{EVENT}` is not in the module's event catalogue",
    )
    for ghost in ("printing.job.printed", "printing.job.failed"):
        check(
            f"events.emits[{ghost}]",
            ghost not in emits,
            "nobody emits it yet (runtime-owned outcome) — a declared event that never fires is a flow that never runs",
        )

    caps = MANIFEST.get("capabilities") or {}
    check(
        "capabilities.printer",
        isinstance(caps.get(CAPABILITY), dict),
        "not declared — `deliver_host_print` is default-deny and no owner could ever grant it",
    )

    check(
        "permissions",
        PERMISSION in (MANIFEST.get("permissions") or []),
        f"`{PERMISSION}` must exist to be the command's permission",
    )

    for rel in cmd.get("sql") or []:
        check(
            f"file {rel}",
            (MODULE_DIR / rel).exists(),
            "declared but missing from the package",
        )
    if isinstance(cmd.get("schema"), str):
        check(
            f"file {cmd['schema']}",
            (MODULE_DIR / cmd["schema"]).exists(),
            "declared but missing from the package",
        )
    return cmd


def check_schema(cmd: dict) -> None:
    rel = cmd.get("schema")
    if not isinstance(rel, str) or not (MODULE_DIR / rel).exists():
        return
    schema = json.loads((MODULE_DIR / rel).read_text())
    props = schema.get("properties") or {}
    required = set(schema.get("required") or [])

    check(
        "schema.required",
        {"jobId", "documentType", "document"} <= required,
        f"got {sorted(required)} — `PrintIntent` needs jobId/documentType/document",
    )
    check(
        "schema.required[role]",
        "role" not in required,
        "hub#987: role is an override in deprecation, the hub resolves the station",
    )
    check(
        "schema.required[format]",
        "format" not in required,
        "absent = `receipt`, the same default as the shell",
    )

    job = props.get("jobId") or {}
    check(
        "schema.jobId",
        job.get("type") == "string" and job.get("minLength", 0) >= 1,
        "must be a non-empty string: it is the idempotency key",
    )

    dt = props.get("documentType") or {}
    check(
        "schema.documentType.enum",
        dt.get("enum") == DOCUMENT_TYPES,
        f"got {dt.get('enum')!r} — must mirror `print_queue::DOCUMENT_TYPES` exactly",
    )

    doc = props.get("document") or {}
    check(
        "schema.document",
        doc.get("type") == "object",
        "hub#501: the document is structured JSON, never HTML",
    )

    fmt = props.get("format") or {}
    check(
        "schema.format.enum",
        fmt.get("enum") == FORMATS,
        f"got {fmt.get('enum')!r} — must mirror the queue's paper formats",
    )

    role = props.get("role") or {}
    check(
        "schema.role",
        role.get("type") == "string",
        "role, when present, is the printer role string",
    )

    for snake in ("job_id", "document_type"):
        check(
            f"schema.{snake}",
            snake not in props,
            "camelCase only: those are `NewPrintJob`'s names, and the shell already speaks them",
        )


# ── 6: the SQL, against a real Postgres ──────────────────────────────────────────────────


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
    if isinstance(value, (dict, list)):
        return "'" + json.dumps(value).replace("'", "''") + "'"
    return "'" + str(value).replace("'", "''") + "'"


def bind(sql: str, params: dict) -> str:
    """Params the caller does not supply bind as NULL (`DynNull`, crates/db/src/lib.rs)."""
    return PARAM.sub(lambda m: literal(params.get(m.group(1))), sql)


def run_command(cmd: dict, payload: dict, hub: str = HUB, new_id: str = "id-1") -> None:
    system = {
        "hub_id": hub,
        "current_user_id": "user-1",
        "now": "2026-08-18T10:00:00Z",
        "new_id": new_id,
    }
    for rel in cmd["sql"]:
        sql = (MODULE_DIR / rel).read_text()
        psql([], db=DB, stdin=bind(sql, {**payload, **system}))


def count_jobs(hub: str) -> int:
    out = psql(
        ["-tAc", f"SELECT count(*) FROM printing_jobs WHERE hub_id = '{hub}'"], db=DB
    )
    return int(out.strip() or 0)


def check_sql(cmd: dict) -> None:
    try:
        psql(["-c", f'DROP DATABASE IF EXISTS "{DB}"'])
        psql(["-c", f'CREATE DATABASE "{DB}"'])
    except RuntimeError as exc:
        notes.append(
            f"SKIPPED Postgres layer — no Postgres at `{CONTAINER}`: {str(exc).splitlines()[0]}"
        )
        return
    try:
        for rel in (MANIFEST.get("migrations") or {}).get("postgres", []):
            psql([], db=DB, stdin=(MODULE_DIR / rel).read_text())

        payload = {
            "jobId": "job-abc",
            "documentType": "kitchen_order",
            "document": {"items": [{"name": "Tortilla", "qty": 2}]},
        }
        run_command(cmd, payload)
        check(
            "sql: one record per job",
            count_jobs(HUB) == 1,
            f"got {count_jobs(HUB)} rows",
        )

        # Same jobId again (a flow retry, a double click): the queue dedups by jobId; the module's
        # ledger must not turn that into a command error, and must not double the record.
        run_command(cmd, payload, new_id="id-2")
        check(
            "sql: replay of the same jobId is not an error and adds no row",
            count_jobs(HUB) == 1,
            f"got {count_jobs(HUB)} rows",
        )

        # role/format absent bind as NULL and that has to be fine (hub#987: role is optional).
        run_command(
            cmd,
            {"jobId": "job-2", "documentType": "receipt", "document": {}},
            new_id="id-3",
        )
        check(
            "sql: role/format absent is accepted",
            count_jobs(HUB) == 2,
            f"got {count_jobs(HUB)} rows",
        )

        # Same jobId in ANOTHER hub is another job — the key is per hub (row contract §2.5).
        run_command(cmd, payload, hub=OTHER_HUB, new_id="id-4")
        check(
            "sql: jobId is scoped per hub",
            count_jobs(OTHER_HUB) == 1 and count_jobs(HUB) == 2,
        )

        row = psql(
            [
                "-tAc",
                "SELECT row_to_json(r) FROM (SELECT job_id, document_type, role, format, created_by FROM printing_jobs WHERE hub_id = 'hub-test' AND job_id = 'job-abc') r",
            ],
            db=DB,
        )
        rec = json.loads(row.strip()) if row.strip() else {}
        check(
            "sql: the record keeps what was asked",
            rec.get("document_type") == "kitchen_order"
            and rec.get("created_by") == "user-1",
            f"got {rec!r}",
        )
    except RuntimeError as exc:
        failures.append(f"sql: {str(exc).splitlines()[0]}")
    finally:
        psql(["-c", f'DROP DATABASE IF EXISTS "{DB}" WITH (FORCE)'])


def main() -> int:
    cmd = check_manifest()
    if cmd is not None:
        check_schema(cmd)
        if cmd.get("sql") and all((MODULE_DIR / r).exists() for r in cmd["sql"]):
            check_sql(cmd)
    for note in notes:
        print(f"  · {note}")
    if failures:
        print(f"FAILED — {len(failures)} broken promise(s) in `{COMMAND}`:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"PASS — `{COMMAND}` emits `{EVENT}` the way the hub's listener-host expects")
    return 0


if __name__ == "__main__":
    sys.exit(main())
