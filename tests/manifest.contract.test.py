#!/usr/bin/env python3
"""Manifest contract test (printing#9) — `module.json` must parse the way the RUNTIME parses it.

Ported from the twin files in `tables` (tables#28) and `inventory` (inventory#31), where v2.2.10
shipped `"catch_up": false` on a field the contract declares as a string enum. `Manifest::load` is a
plain `serde_json::from_str::<Manifest>` and it is the FIRST thing `installer::install` does, so one
wrong JSON type did not degrade a feature — it closed the door: the published module could not be
installed on ANY hub. Nothing in that repo noticed, because `erplora validate` re-implements a
subset of the JSON Schema by hand instead of applying it.

It lands here now because of the `setup` block (hub#369 / ADR-0222): the runtime used to throw it
away with serde and the shell read the raw `module.json`, so a typo there was cosmetic. It is
parsed into `SetupDef` today, which puts it on exactly the same footing as `catch_up`: a malformed
`setup` is a malformed manifest, and a malformed manifest is an uninstallable module.

Four layers, all in this one file, no services needed:

  1. TYPE CONTRACT (always, zero dependencies). Mirrors the serde model of
     `hub/crates/runtime/src/manifest.rs`: every block declared here must carry the JSON type the
     runtime deserializes it into. A boolean where a string enum belongs fails HERE, in the repo,
     before a release ever reaches a hub.

  2. 🪦 NO `setup` BLOCK (printing#44). This module used to contribute the «Your printer» item of
     `hub.setup.status`, ticked when `receipt_header` was filled in — a field that since hub#1921
     reaches no paper at all (the ticket is the sales viewer's document, built from
     `sales.pos_settings.get`). What the step really needs, a printer carrying the `receipt` role,
     lives in the CORE's device registry and a `setup.query` has to be a query of the module
     ITSELF, so there is nothing honest left here to measure: every other column this module
     stores has a working default and would tick on day one. The core item that CAN see the
     printers is ERPlora/hub#1948, and `tests/legacy_receipt_text.postgres.test.py` proves the
     text a shop typed here still survives to be moved.

  3. CANONICAL JSON SCHEMA (when reachable). If `jsonschema` is importable and the hub checkout is
     at hand (`ERPLORA_MODULE_SCHEMA`, or the sibling checkout used by the dev workspace), the
     manifest is validated against `hub/schemas/module.schema.json` ITSELF — the source of truth,
     no re-implementation, no drift. Unreachable is reported as SKIPPED, never as a pass.

  4. DECLARED FILES EXIST. Every path the manifest points at (migrations, seed, query/command SQL,
     JSON Schemas, the WASM handler, the UI bundle) must be in the package. A manifest that points
     at a file the zip does not carry breaks on the hub, not here.

Usage: tests/manifest.contract.test.py   (exit 0 = green)
"""

import json
import os
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST_PATH = MODULE_DIR / "module.json"
LOCALES_DIR = MODULE_DIR / "locales"

# `enum CatchUp` in hub/crates/runtime/src/manifest.rs (`#[serde(rename_all = "lowercase")]`),
# mirrored by `$defs/scheduledTask.catch_up` in hub/schemas/module.schema.json. There is no
# "run every missed execution" mode on purpose: `collapse` (the default) runs the backlog ONCE,
# `skip` does not run it at all. A boolean is not a member of this enum.
CATCH_UP_VALUES = ("collapse", "skip")

# Dialects the runtime knows about (`struct Migrations`).
SQL_DIALECTS = ("sqlite", "postgres")

# Top-level blocks of the contract. The canonical schema declares `additionalProperties: false`;
# here an unknown key is only a warning, so that a manifest using a block newer than this list
# does not turn red for no reason (layer 2 is the strict one). Extend when the contract grows.
KNOWN_TOP_LEVEL = {
    "id",
    "name",
    "version",
    "description",
    "icon",
    "billing",
    "marketplace",
    "roles",
    "depends_on",
    "permissions",
    "role_permissions",
    "navigation",
    "migrations",
    "seed",
    "queries",
    "commands",
    "events",
    "agent",
    "ai_context",
    "scheduled_tasks",
    "widgets",
    "settings",
    "static_files",
    "provides_slots",
    "ui",
    "notify",
    "network",
    "capabilities",
    "setup",
}

JSON_TYPE_NAME = {
    bool: "boolean",
    int: "number",
    float: "number",
    str: "string",
    list: "array",
    dict: "object",
    type(None): "null",
}

failures: list[str] = []
warnings: list[str] = []
notes: list[str] = []


def type_name(value) -> str:
    return JSON_TYPE_NAME.get(type(value), type(value).__name__)


def expect(path: str, value, kind, enum: tuple | None = None) -> bool:
    """Assert the JSON type of `value`. `True`/`False` never pass as a number or a string:
    in Python `bool` is a subclass of `int`, in JSON it is a type of its own — and confusing
    the two is exactly the bug this file guards against."""
    ok = isinstance(value, kind) and not (isinstance(value, bool) and kind is not bool)
    if not ok:
        failures.append(
            f"{path}: expected {kind.__name__}, got {type_name(value)} ({value!r})"
        )
        return False
    if enum is not None and value not in enum:
        failures.append(f"{path}: {value!r} is not one of {list(enum)}")
        return False
    return True


def field(
    path: str,
    obj: dict,
    key: str,
    kind,
    required: bool = False,
    enum: tuple | None = None,
):
    """Check one key of an object. Absent (or `null`, which serde reads as `None` for an
    `Option<T>`) is fine unless the field is required."""
    if key not in obj or obj[key] is None:
        if required:
            failures.append(f"{path}.{key}: missing, and the runtime requires it")
        return None
    expect(f"{path}.{key}", obj[key], kind, enum)
    return obj[key]


def string_array(path: str, value) -> None:
    if not expect(path, value, list):
        return
    for i, item in enumerate(value):
        expect(f"{path}[{i}]", item, str)


# ── Layer 1: the type contract, mirroring `struct Manifest` ──────────────────────────────


def check_identity(m: dict) -> None:
    field("", m, "id", str, required=True)
    field("", m, "name", str, required=True)
    field("", m, "version", str, required=True)
    field("", m, "description", str)

    if m.get("id") != MODULE_DIR.name:
        failures.append(
            f"id: {m.get('id')!r} does not match the module folder {MODULE_DIR.name!r}"
        )

    # The release bot bumps module.json and package.json together; a mismatch means a half-applied
    # release, and the marketplace publishes whatever module.json says.
    pkg_path = MODULE_DIR / "package.json"
    if pkg_path.exists():
        pkg_version = json.loads(pkg_path.read_text()).get("version")
        if pkg_version != m.get("version"):
            failures.append(
                f"version: module.json says {m.get('version')!r}, package.json says {pkg_version!r}"
            )


def check_permissions(m: dict) -> None:
    string_array("depends_on", m.get("depends_on", []))
    string_array("permissions", m.get("permissions", []))

    roles = m.get("role_permissions", {})
    if expect("role_permissions", roles, dict):
        for role, perms in roles.items():
            string_array(f"role_permissions.{role}", perms)


def check_navigation(m: dict) -> None:
    nav = m.get("navigation", [])
    if not expect("navigation", nav, list):
        return
    for i, entry in enumerate(nav):
        path = f"navigation[{i}]"
        if not expect(path, entry, dict):
            continue
        field(path, entry, "id", str, required=True)
        field(path, entry, "label", str, required=True)
        field(path, entry, "component", str, required=True)
        field(path, entry, "icon", str)
        for j, action in enumerate(entry.get("actions", [])):
            apath = f"{path}.actions[{j}]"
            if not expect(apath, action, dict):
                continue
            field(apath, action, "id", str, required=True)
            field(apath, action, "label", str, required=True)
            field(apath, action, "icon", str)
            field(apath, action, "permission", str)
            field(apath, action, "primary", bool)


def check_sql_blocks(m: dict) -> None:
    for block in ("migrations", "seed"):
        value = m.get(block, {})
        if not expect(block, value, dict):
            continue
        for dialect, files in value.items():
            if dialect not in SQL_DIALECTS:
                failures.append(f"{block}.{dialect}: unknown SQL dialect {dialect!r}")
                continue
            string_array(f"{block}.{dialect}", files)

    queries = m.get("queries", {})
    if expect("queries", queries, dict):
        for name, q in queries.items():
            path = f"queries.{name}"
            if not expect(path, q, dict):
                continue
            field(path, q, "permission", str, required=True)
            field(path, q, "sql", str, required=True)
            field(path, q, "schema", str)
            field(path, q, "expose_api", bool)
            if "list" in q and expect(f"{path}.list", q["list"], dict):
                spec = q["list"]
                string_array(f"{path}.list.search", spec.get("search", []))
                string_array(f"{path}.list.sort", spec.get("sort", []))
                field(f"{path}.list", spec, "default_sort", str)
                field(f"{path}.list", spec, "default_dir", str)
                field(f"{path}.list", spec, "page_size", int)

    commands = m.get("commands", {})
    if expect("commands", commands, dict):
        for name, c in commands.items():
            path = f"commands.{name}"
            if not expect(path, c, dict):
                continue
            field(path, c, "permission", str, required=True)
            field(path, c, "schema", str)
            field(path, c, "transaction", bool)
            field(path, c, "internal", bool)
            field(path, c, "expose_api", bool)
            field(path, c, "min_affected_rows", int)
            string_array(f"{path}.sql", c.get("sql", []))
            string_array(f"{path}.emit", c.get("emit", []))
            if "handler" in c and expect(f"{path}.handler", c["handler"], dict):
                h = c["handler"]
                field(f"{path}.handler", h, "type", str, required=True)
                field(f"{path}.handler", h, "file", str, required=True)
                field(f"{path}.handler", h, "function", str, required=True)


def check_events_and_slots(m: dict) -> None:
    events = m.get("events", {})
    if expect("events", events, dict):
        listen = events.get("listen", {})
        if expect("events.listen", listen, dict):
            for topic, listener in listen.items():
                path = f"events.listen.{topic}"
                if expect(path, listener, dict):
                    field(path, listener, "command", str, required=True)
        string_array("events.emits", events.get("emits", []))

    slots = m.get("provides_slots", [])
    if expect("provides_slots", slots, list):
        for i, slot in enumerate(slots):
            path = f"provides_slots[{i}]"
            if not expect(path, slot, dict):
                continue
            field(path, slot, "slot", str, required=True)
            field(path, slot, "component", str, required=True)
            field(path, slot, "permission", str)
            field(path, slot, "priority", int)

    if "ui" in m and expect("ui", m["ui"], dict):
        field("ui", m["ui"], "entry", str, required=True)

    if "agent" in m and expect("agent", m["agent"], dict):
        field("agent", m["agent"], "description", str, required=True)
        string_array("agent.keywords", m["agent"].get("keywords", []))


def check_scheduled_tasks(m: dict) -> None:
    """The block that shipped broken in v2.2.10 (tables#28).

    `catch_up` is a STRING enum, not a flag. A boolean here aborts `Manifest::load`, and with it
    the whole install — so this assertion is the one that must never go soft.
    """
    tasks = m.get("scheduled_tasks", [])
    if not expect("scheduled_tasks", tasks, list):
        return
    for i, task in enumerate(tasks):
        path = f"scheduled_tasks[{i}]"
        if not expect(path, task, dict):
            continue
        field(path, task, "name", str, required=True)
        field(path, task, "command", str, required=True)
        field(path, task, "cron", str, required=True)
        field(path, task, "payload", dict)
        if "catch_up" in task:
            if isinstance(task["catch_up"], bool):
                failures.append(
                    f"{path}.catch_up: {task['catch_up']!r} is a boolean — the contract is the "
                    f"string enum {list(CATCH_UP_VALUES)} (ADR-0011). This is tables#28: a "
                    f"boolean here makes the module impossible to install on ANY hub."
                )
            else:
                expect(f"{path}.catch_up", task["catch_up"], str, CATCH_UP_VALUES)

        command = task.get("command")
        if isinstance(command, str):
            if command not in m.get("commands", {}):
                failures.append(
                    f"{path}.command: {command!r} is not declared in `commands`"
                )
            if not command.startswith(f"{m.get('id')}."):
                failures.append(
                    f"{path}.command: {command!r} does not belong to this module"
                )


# ── Layer 2: NO `setup` block (printing#44) ───────────────────────────────────────────────


def locale(lang: str) -> dict:
    path = LOCALES_DIR / f"{lang}.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        failures.append(f"locales/{lang}.json: not valid JSON ({exc})")
        return {}


def check_no_setup_item(m: dict) -> None:
    """This module contributes NO item to the onboarding checklist, and that is a decision.

    It used to own slot 70 («Your printer»), ticked when `receipt_header` was filled in. Since
    hub#1921 that field reaches no paper: both tickets are the sales viewer's document, built from
    `sales.pos_settings.get`. So the item asked every brand-new salon for a datum its own receipt
    does not use, and kept the step pending until it was typed (printing#44).

    It cannot simply point somewhere else: `setup.query` has to be a query of the module ITSELF
    (`module_item_done`, hub/crates/runtime/src/setup_status.rs) and the only thing worth measuring
    — a printer carrying the `receipt` role — lives in the core's device registry, never in a
    `printing_*` table. Every other column here has a working default, so any check over them would
    tick on day one, and a false «done» hides the task for good. The core item that CAN see the
    printers is ERPlora/hub#1948.
    """
    setup = m.get("setup")
    if setup is None:
        return
    failures.append(
        "setup: declared again — the only thing this module can measure about its own settings is "
        "`receipt_header`, and since hub#1921 no paper reads it (the ticket is built from "
        "`sales.pos_settings.get`). An item ticked by that field asks a brand-new salon for a "
        "datum its receipt does not use. The printer step belongs to the core, which can see the "
        "roles: ERPlora/hub#1948"
    )


def check_unknown_top_level(m: dict) -> None:
    for key in sorted(set(m) - KNOWN_TOP_LEVEL):
        warnings.append(
            f"{key}: not a block this test knows about — the canonical schema declares "
            f"`additionalProperties: false`, so either it is a typo or this list is stale"
        )


# ── Layer 3: the canonical JSON Schema, when it is reachable ─────────────────────────────


def canonical_schema_path() -> pathlib.Path | None:
    override = os.environ.get("ERPLORA_MODULE_SCHEMA")
    if override:
        return pathlib.Path(override)
    # Dev workspace layout: <root>/modules-workspace/modules/<id>/ next to <root>/hub/.
    sibling = MODULE_DIR.parents[2] / "hub" / "schemas" / "module.schema.json"
    return sibling if sibling.exists() else None


def check_against_canonical_schema(m: dict) -> None:
    try:
        import jsonschema
    except ImportError:
        notes.append(
            "SKIPPED canonical schema: `jsonschema` is not installed (pip install jsonschema)"
        )
        return

    path = canonical_schema_path()
    if path is None or not path.exists():
        notes.append(
            "SKIPPED canonical schema: hub/schemas/module.schema.json not found "
            "(set ERPLORA_MODULE_SCHEMA to point at it)"
        )
        return

    schema = json.loads(path.read_text())
    validator = jsonschema.Draft202012Validator(schema)
    notes.append(f"canonical schema applied: {path}")

    # A checkout older than hub#369 declares `setup` with `additionalProperties: false` and without
    # `order`/`countries`, so it would reject a correct manifest. That is the checkout being stale,
    # not the module being wrong: the `setup` errors are dropped and said out loud (layer 2 checked
    # the block on its own anyway). Never the other way round — a stale schema is never a pass.
    setup_props = schema.get("properties", {}).get("setup", {}).get("properties", {})
    stale = "order" not in setup_props or "countries" not in setup_props
    if stale:
        notes.append(
            "SKIPPED `setup` in the canonical schema: this checkout predates hub#369 "
            "(no `order`/`countries`) — update it, or point ERPLORA_MODULE_SCHEMA at a current one"
        )

    for err in sorted(validator.iter_errors(m), key=lambda e: list(e.absolute_path)):
        where = "/".join(str(p) for p in err.absolute_path) or "<root>"
        about_setup = (
            where == "setup"
            or where.startswith("setup/")
            or (where == "<root>" and "'setup'" in err.message)
        )
        if stale and about_setup:
            continue
        failures.append(f"[schema] {where}: {err.message}")


# ── Layer 4: everything the manifest points at is in the package ─────────────────────────


def check_declared_files_exist(m: dict) -> None:
    declared: list[tuple[str, str]] = []

    for block in ("migrations", "seed"):
        for dialect, files in (m.get(block) or {}).items():
            if isinstance(files, list):
                declared += [
                    (f"{block}.{dialect}", f) for f in files if isinstance(f, str)
                ]

    for name, q in (m.get("queries") or {}).items():
        for key in ("sql", "schema"):
            if isinstance(q, dict) and isinstance(q.get(key), str):
                declared.append((f"queries.{name}.{key}", q[key]))

    for name, c in (m.get("commands") or {}).items():
        if not isinstance(c, dict):
            continue
        for rel in c.get("sql") or []:
            if isinstance(rel, str):
                declared.append((f"commands.{name}.sql", rel))
        if isinstance(c.get("schema"), str):
            declared.append((f"commands.{name}.schema", c["schema"]))
        handler = c.get("handler")
        if isinstance(handler, dict) and isinstance(handler.get("file"), str):
            declared.append((f"commands.{name}.handler.file", handler["file"]))

    if isinstance(m.get("ui"), dict) and isinstance(m["ui"].get("entry"), str):
        declared.append(("ui.entry", m["ui"]["entry"]))
    if isinstance(m.get("settings"), dict) and isinstance(
        m["settings"].get("schema"), str
    ):
        declared.append(("settings.schema", m["settings"]["schema"]))

    for where, rel in declared:
        if not (MODULE_DIR / rel).exists():
            failures.append(f"{where}: declares `{rel}`, which is not in the package")


# ── Runner ───────────────────────────────────────────────────────────────────────────────


def main() -> int:
    raw = MANIFEST_PATH.read_text()
    try:
        manifest = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"FAILED — module.json is not valid JSON: {exc}")
        return 1

    check_identity(manifest)
    check_permissions(manifest)
    check_navigation(manifest)
    check_sql_blocks(manifest)
    check_events_and_slots(manifest)
    check_scheduled_tasks(manifest)
    check_no_setup_item(manifest)
    check_unknown_top_level(manifest)
    check_against_canonical_schema(manifest)
    check_declared_files_exist(manifest)

    for note in notes:
        print(f"  · {note}")
    for warning in warnings:
        print(f"  ! {warning}")
    print()

    if failures:
        print(f"FAILED — {len(failures)} contract violation(s) in module.json:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        f"PASS — module.json v{manifest.get('version')} parses the way the runtime parses it"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
