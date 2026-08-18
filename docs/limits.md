# Printing — Limits and troubleshooting

## Known limitations you should know about

- **No printing happens in the hub.** The device does it; the hub only holds the configuration.
- **The print queue is the hub's, not this module's.** `printing.jobs.create` hands a document to
  it and keeps its own record of the request (`printing_jobs`); what happened on paper is known by
  the hub, not by this module.
- **No printer discovery here.** The local app finds printers.
- **A routing category is unvalidated free text.** A typo produces a rule that never matches.
- **No label printing**, despite the keyword in the module description.
- **One event only: `printing.print.due`**, the print intention the hub consumes. There is no
  `printed`/`failed` event yet, so nothing can react to the outcome of a job.

## Accepted values

| Field | Values |
|---|---|
| Station | `receipt`, `kitchen`, `bar` |
| Paper width | `80` or `58` (millimetres) |
| Auto-print on sale | 0 or 1 |
| Open drawer on sale | 0 or 1 |
| Print kitchen | 0 or 1 (legacy column, no control on screen; nothing reads it since ADR-0144) |

## Required fields

| Action | Must provide |
|---|---|
| Update settings | **all six**: `receipt_header`, `receipt_footer`, `paper_width`, `auto_print_on_sale`, `open_drawer_on_sale`, `print_kitchen` |
| Set a routing rule | `category`, `station` |
| Remove a routing rule | `category` |

## Caps and sizes

| Limit | Value |
|---|---|
| Rows per page (routing rules) | 50 |
| Maximum rows a paginated request may ask for | 500 |
| Stations per category | 1 |
| Settings rows per hub | 1 |

## Permissions per action

| To do this | You need |
|---|---|
| See the printing settings | `printing.view_settings` |
| Change the printing settings | `printing.manage_settings` |
| See the routing rules | `printing.view_routing` |
| Set or remove a routing rule | `printing.manage_routing` |
| Print | `printing.print` |
| Open the cash drawer | `printing.open_drawer` |

By role: **admin** has everything. **manager** has all six. **employee** can **see** the settings and
the routing, **print** and **open the drawer** — but cannot change any configuration.

## Dependencies

**None in either direction.** Printing depends on no module and no module depends on it. It listens to
no events; it emits `printing.print.due` (consumed by the hub itself, not by another module).

To let anything reach paper through `printing.jobs.create`, the owner must **grant the `printer`
capability** to this module (Settings → Permissions). Without the grant the request is recorded, the
event is emitted, and the hub refuses to queue it (`host.print: capability denied` in the dead-letter).

Practical consequences:

- **Installing it does not make anything print.** The device must be running the ERPlora app and have
  a printer.
- **`kitchen` does not use these routing rules.** It has its own stations, its own destinations and
  its own printer roles, and the kitchen ticket is printed by the shell so that it prints even when
  the kitchen display is not open.
- **`sales` does not read these settings for its receipt text.** The till has its own receipt header,
  footer and marketing QR in its own settings. If your header appears in one place and not another,
  that is why.

## When something looks wrong

**"Nothing prints."** This is almost always the device, not the hub. Check: is the ERPlora app running
on the device with the printer? Is the printer on and reachable? Is **auto-print on sale** enabled?
Do you have `printing.print`?

**"The receipt prints but the drawer does not open."** They are separate settings. Enable **open
drawer on sale**, and check you have `printing.open_drawer`.

**"The receipt layout looks wrong."** The paper width does not match the roll. Set 80 or 58 to match
what is loaded.

**"My header does not appear on the sale receipt."** `sales` has its own receipt header and footer in
its settings. Check there too.

**"Kitchen lines do not print."** If `kitchen` is installed, its **stations** decide: a station whose
destination is screen-only never goes to paper. This module's routing does not override that.

**"A routing rule does nothing."** The category string must match exactly. It is free text with no
validation, so a rename in the catalogue or a typo leaves an orphan rule.

**"I set two stations for one category."** You cannot; setting a rule replaces the previous one.

**"A print failed — where do I see it?"** Nowhere. There is no history and no retry. Reprint from the
document itself.

**"I changed the settings and the old receipt did not change."** Settings apply to what is printed
next. A document already printed is paper.
