# Printing — Limits and troubleshooting

## Known limitations you should know about

- **No printing happens in the hub.** The device does it; the hub only holds the configuration.
- **The receipt text is not set here.** The header and footer of the ticket are part of your till
  settings (Sales → Settings): both papers are printed from there. Two boxes used to live on this
  screen; what was typed in them reached no paper, so they were removed and the screen now links to
  the receipt settings — and offers to move the old text over, filling only what is still empty
  there.
- **The print queue is the hub's, not this module's.** `printing.jobs.create` hands a document to
  it and keeps its own record of the request (`printing_jobs`); what happened on paper is known by
  the hub, not by this module.
- **No printer discovery here.** The local app finds printers.
- **This module routes nothing.** The Routing tab, its query and its two commands were retired in
  printing#25 — nothing had read them since ADR-0144. Routing by category is `kitchen` → Stations.
- **No label printing**, despite the keyword in the module description.
- **One event only: `printing.print.due`**, the print intention the hub consumes. There is no
  `printed`/`failed` event yet, so nothing can react to the outcome of a job.

## Accepted values

| Field | Values |
|---|---|
| Paper width | `80` or `58` (millimetres) |
| Auto-print on sale | 0 or 1 |
| Open drawer on sale | 0 or 1 |
| Print kitchen | 0 or 1 (legacy column, no control on screen; nothing reads it since ADR-0144, but the `settings.update` payload still requires it) |

## Required fields

| Action | Must provide |
|---|---|
| Update settings | **all four**: `paper_width`, `auto_print_on_sale`, `open_drawer_on_sale`, `print_kitchen`. `receipt_header`/`receipt_footer` are no longer accepted: the door ignores them, and the text of the receipt is set in Sales |

## Caps and sizes

| Limit | Value |
|---|---|
| Settings rows per hub | 1 |

## Permissions per action

| To do this | You need |
|---|---|
| See the printing settings | `printing.view_settings` |
| Change the printing settings | `printing.manage_settings` |
| Print | `printing.print` |
| Open the cash drawer | `printing.open_drawer` |

By role: **admin** has everything. **manager** has all four. **employee** can **see** the settings,
**print** and **open the drawer** — but cannot change any configuration.

`printing.view_routing` and `printing.manage_routing` **no longer exist** (printing#25): they gated a
screen nothing read.

## Dependencies

**None in either direction.** Printing depends on no module and no module depends on it. It listens to
no events; it emits `printing.print.due` (consumed by the hub itself, not by another module).

To let anything reach paper through `printing.jobs.create`, the owner must **grant the `printer`
capability** to this module (Settings → Permissions). Without the grant the request is recorded, the
event is emitted, and the hub refuses to queue it (`host.print: capability denied` in the dead-letter).

Practical consequences:

- **Installing it does not make anything print.** The device must be running the ERPlora app and have
  a printer.
- **Routing by category is `kitchen`'s job.** It has its own stations, its own destinations and its
  own printer roles, and the kitchen ticket is printed by the shell so that it prints even when the
  kitchen display is not open. The rules that used to live here never did anything.
- **The receipt text belongs to `sales`.** The till holds the header, the footer and the marketing
  QR of the ticket, and both papers are built from there. The two old columns of this module are
  kept only so that text typed before the move is not lost.

## When something looks wrong

**"Nothing prints."** This is almost always the device, not the hub. Check: is the ERPlora app running
on the device with the printer? Is the printer on and reachable? Is **auto-print on sale** enabled?
Do you have `printing.print`?

**"The receipt prints but the drawer does not open."** They are separate settings. Enable **open
drawer on sale**, and check you have `printing.open_drawer`.

**"The receipt layout looks wrong."** The paper width does not match the roll. Set 80 or 58 to match
what is loaded.

**"My header does not appear on the sale receipt."** The receipt header and footer live in the till
settings (Sales → Settings). If you had typed yours on this screen, it is shown here with a button
that moves it over; you can also copy it across by hand.

**"Kitchen lines do not print."** `kitchen`'s **stations** decide: a station whose destination is
screen-only never goes to paper.

**"Where did the Routing tab go?"** Retired in printing#25 — nothing ever applied those rules
(ADR-0144). Route by category in `kitchen` → **Stations**, which does apply them (sales#12,
kitchen#32). Your old rows are still in `printing_routing`, unreachable, and were not destroyed.

**"A new business does not print on sale until I press Save."** Fixed in printing#42: the settings
now answer their defaults before the first Save, so auto-print on sale works from the first sale. On
an older version, pressing Save once on the Printers screen is the workaround.

**"I save the settings and the form comes back empty."** Fixed in printing#25: the save now revives a
soft-deleted settings row. If you are on an older version, that state also made the `printing.setup`
checklist item impossible to tick.

**"A print failed — where do I see it?"** Nowhere. There is no history and no retry. Reprint from the
document itself.

**"I changed the settings and the old receipt did not change."** Settings apply to what is printed
next. A document already printed is paper.
