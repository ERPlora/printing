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

  2. THE `setup` BLOCK (printing#9). Beyond its JSON types, the checks the schema cannot make:
     the declared query belongs to this module and IS declared, the fields of `configured_when`
     are columns that query actually returns, the route points at a screen this manifest declares,
     the permission is one this module declares, and the English `title` has its `es` translation.
     Whether the query answers what the item claims is proved for real, against Postgres, in
     `tests/setup_query.postgres.test.py`.

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

# Slot the CORE reserved for this module's checklist item — `architecture/hub/setup-status.md` §6,
# "los huecos reservados". The scale belongs to the core (apps=10, business data=40, team=80); a
# module does not get to pick its own place in the list, it takes the one it was assigned.
SETUP_ORDER = 70

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


# ── Layer 2: the `setup` block (printing#9, hub#369 / ADR-0222) ──────────────────────────


def split_top_level(select_list: str) -> list[str]:
    """Split a SELECT list on its top-level commas, ignoring the ones inside parentheses."""
    items: list[str] = []
    depth = 0
    current = ""
    for char in select_list:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            items.append(current)
            current = ""
        else:
            current += char
    items.append(current)
    return items


def sql_output_columns(sql_path: pathlib.Path) -> set[str] | None:
    """Column names a query gives back, read off its SELECT list. `None` = cannot tell.

    Why it matters: a `configured_when` field the query does not return is NOT an error on the hub.
    It reads as a missing value, a missing value is falsy, and the item stays pending forever — the
    checklist nagging about something already done, with nothing anywhere going red.

    The twin in `inventory` only read the `AS` aliases, because its check runs on an aggregate
    (`… AS total_products`). Here the query is `SELECT id, receipt_header, …` with no alias in
    sight, so alias-only would have quietly checked nothing at all. Both forms are read: the alias
    when there is one, the bare column name otherwise. Anything this cannot name for sure — a `*`,
    an unaliased expression — returns `None`, which is reported as skipped rather than passed; the
    real proof is `tests/setup_query.postgres.test.py`, which asks Postgres.
    """
    if not sql_path.exists():
        return None
    sql = re.sub(r"--[^\n]*", "", sql_path.read_text())
    match = re.search(r"\bSELECT\b(.+?)\bFROM\b", sql, re.IGNORECASE | re.DOTALL)
    if not match:
        return None

    columns: set[str] = set()
    for item in split_top_level(match.group(1)):
        item = item.strip()
        if not item or item == "*" or item.endswith(".*"):
            return None
        alias = re.search(r"\bAS\s+([A-Za-z_][A-Za-z0-9_]*)\s*$", item, re.IGNORECASE)
        if alias:
            columns.add(alias.group(1).lower())
            continue
        bare = re.fullmatch(
            r"([A-Za-z_][A-Za-z0-9_]*\.)?([A-Za-z_][A-Za-z0-9_]*)", item
        )
        if not bare:
            # An expression the driver names on its own terms: guessing would be worse than
            # admitting we do not know.
            return None
        columns.add(bare.group(2).lower())
    return columns or None


def locale(lang: str) -> dict:
    path = LOCALES_DIR / f"{lang}.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        failures.append(f"locales/{lang}.json: not valid JSON ({exc})")
        return {}


def check_setup(m: dict) -> None:
    """The onboarding checklist item this module contributes to `hub.setup.status`.

    The runtime runs `query`, takes the FIRST row and ticks the item when every `configured_when`
    check passes; no row at all is "not configured" (ADR-0063). Everything else about the item —
    its `key`, whether it blocks a sale — is core-owned, so it must not appear here.
    """
    setup = m.get("setup")
    if setup is None:
        failures.append(
            "setup: missing — this module owns slot 70 of the onboarding checklist "
            "(«Your printer», architecture/hub/setup-status.md §6). Without the block, "
            "`hub.setup.status` never tells a brand-new hub that nobody has set up its receipt."
        )
        return
    if not expect("setup", setup, dict):
        return

    module_id = m.get("id", "")

    # The four the runtime deserializes without a `#[serde(default)]`: absent = `Manifest::load`
    # fails = the module cannot be installed.
    query = field("setup", setup, "query", str, required=True)
    title = field("setup", setup, "title", str, required=True)
    route = field("setup", setup, "route", str, required=True)
    field("setup", setup, "params", dict)
    description = field("setup", setup, "description", str)
    field("setup", setup, "icon", str)
    permission = field("setup", setup, "permission", str)
    field("setup", setup, "required", bool)

    # `key` is derived by the core as `<module_id>.setup` precisely so that a manifest cannot
    # rename itself out of the ⛔ list of hub#370. Declaring one is not "ignored": the canonical
    # schema is `additionalProperties: false`, so it fails the install.
    if "key" in setup:
        failures.append(
            "setup.key: must not be declared — the core derives it as "
            f"`{module_id}.setup`, and the schema rejects the extra property"
        )

    # `order` is an integer slot on a scale the core owns, not a preference.
    if "order" in setup and expect("setup.order", setup["order"], int):
        if setup["order"] != SETUP_ORDER:
            failures.append(
                f"setup.order: {setup['order']} is not the slot the core reserved for this "
                f"module ({SETUP_ORDER}) — see the table in architecture/hub/setup-status.md §6"
            )

    # Owning a printer is not a national obligation: `countries` exists for items like VeriFactu.
    countries = setup.get("countries")
    if countries is not None and expect("setup.countries", countries, list):
        for i, code in enumerate(countries):
            if expect(f"setup.countries[{i}]", code, str) and not re.fullmatch(
                r"[A-Za-z]{2}", code
            ):
                failures.append(
                    f"setup.countries[{i}]: {code!r} is not an ISO-3166-1 alpha-2 code"
                )

    # ── configured_when ──────────────────────────────────────────────────────────────────
    checks = setup.get("configured_when")
    if checks is None:
        failures.append("setup.configured_when: missing, and the runtime requires it")
        checks = []
    elif expect("setup.configured_when", checks, list) and not checks:
        # `[]` parses fine and means "merely having a row is enough". For this item that is exactly
        # the lie to avoid: the settings row exists the moment anyone hits Save on the Printers
        # screen, defaults and all, whether or not the receipt is set up to say anything.
        failures.append(
            "setup.configured_when: empty — the settings row exists as soon as the screen is "
            "saved once, so a bare row would tick the item with the receipt still unconfigured"
        )

    fields: list[str] = []
    for i, check in enumerate(checks if isinstance(checks, list) else []):
        path = f"setup.configured_when[{i}]"
        if not expect(path, check, dict):
            continue
        name = field(path, check, "field", str, required=True)
        if isinstance(name, str):
            fields.append(name)
        has_truthy = check.get("truthy") is not None
        has_equals = check.get("equals") is not None
        if has_truthy:
            expect(f"{path}.truthy", check["truthy"], bool)
        if has_truthy == has_equals:
            # Neither is a check that never passes (the runtime says so out loud); both is a
            # contract that reads two ways.
            failures.append(
                f"{path}: declares {'both' if has_truthy else 'neither'} `truthy` and `equals` — "
                f"the contract is exactly one of the two"
            )
        for key in set(check) - {"field", "truthy", "equals"}:
            failures.append(f"{path}.{key}: not part of the check contract")

    # ── the query has to be this module's, declared, and to return those columns ──────────
    queries = m.get("queries") or {}
    if isinstance(query, str):
        if not query.startswith(f"{module_id}."):
            failures.append(
                f"setup.query: {query!r} is not a query of this module — the runtime runs it "
                f"through the dispatcher with the caller's permissions, not somebody else's"
            )
        spec = queries.get(query)
        if spec is None:
            # Best-effort (§5): a check that cannot run is dropped, never reported as pending. So
            # a typo here does not fail loudly on the hub — the item just never shows up.
            failures.append(
                f"setup.query: {query!r} is not declared in `queries` — the item would be "
                f"silently omitted from the checklist instead of failing"
            )
        elif isinstance(spec, dict) and isinstance(spec.get("sql"), str):
            columns = sql_output_columns(MODULE_DIR / spec["sql"])
            if columns is None:
                notes.append(
                    f"SKIPPED column check: the SELECT list of {spec['sql']} cannot be named "
                    f"statically — `tests/setup_query.postgres.test.py` asks Postgres instead"
                )
            else:
                for name in fields:
                    if name.lower() not in columns:
                        failures.append(
                            f"setup.configured_when: {name!r} is not a column of {spec['sql']} "
                            f"(returns: {', '.join(sorted(columns))}) — on the hub that is not an "
                            f"error, it is a missing value, and a missing value is falsy: the item "
                            f"would stay pending forever"
                        )

    # ── the route has to lead somewhere this manifest declares ───────────────────────────
    if isinstance(route, str):
        if not route.startswith("/"):
            failures.append(f"setup.route: {route!r} is not an absolute shell route")
        elif route.startswith("/m/"):
            parts = route.strip("/").split("/")
            nav_ids = {
                e.get("id") for e in m.get("navigation", []) if isinstance(e, dict)
            }
            if len(parts) < 2 or parts[1] != module_id:
                failures.append(
                    f"setup.route: {route!r} does not point at this module (`/m/{module_id}/…`)"
                )
            elif len(parts) < 3 or parts[2] not in nav_ids:
                failures.append(
                    f"setup.route: {route!r} is not one of this module's screens "
                    f"({', '.join(sorted(str(n) for n in nav_ids))}) — the shell routes "
                    f"`/m/:moduleId/:navId`, so the CTA would land on a dead route"
                )

    # ── the permission is the one to CONFIGURE, and this module declares it ──────────────
    if isinstance(permission, str) and permission:
        if permission not in (m.get("permissions") or []):
            failures.append(
                f"setup.permission: {permission!r} is not declared in `permissions` — nobody "
                f"would ever be offered the item"
            )
        read_permission = (queries.get(query) or {}).get("permission")
        if permission == read_permission:
            failures.append(
                f"setup.permission: {permission!r} is the permission to READ the query. The item "
                f"needs the one to CONFIGURE: whoever only looks must not be handed a task they "
                f"cannot complete (architecture/hub/setup-status.md §5)"
            )

    # ── English canonical in the manifest, translation in locales/ ───────────────────────
    en_setup = locale("en").get("setup") or {}
    es_setup = locale("es").get("setup") or {}
    if isinstance(title, str):
        if en_setup.get("title") != title:
            failures.append(
                f"locales/en.json setup.title: {en_setup.get('title')!r} does not match the "
                f"manifest title {title!r} — the manifest carries the English fallback and the "
                f"UI translates from the same source"
            )
        if not es_setup.get("title"):
            failures.append(
                "locales/es.json setup.title: missing — visible text ships as English source "
                "PLUS its `es` translation, never English only"
            )
    if description:
        if en_setup.get("description") != description:
            failures.append(
                "locales/en.json setup.description: does not match the manifest description"
            )
        if not es_setup.get("description"):
            failures.append("locales/es.json setup.description: missing")


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
    check_setup(manifest)
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
