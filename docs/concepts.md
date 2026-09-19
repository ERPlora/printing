# Printing — Concepts

The things people get wrong on their first day.

## Settings live in the hub; printing happens on the device

The hub stores **what should be printed and how**. The **device** running the ERPlora app does the
printing and opens the drawer.

That split explains almost every question about this module:

- Changing the header here changes what the **next** receipt says, everywhere.
- A printer that does not respond is a **device** problem; nothing in these settings fixes it.
- Two tills can share the same settings and have completely different printers.

## The queue is the hub's; this module only feeds it

The print spool, its retries and the record of what came out belong to the hub (ADR-0196 §6), not to
this module. What this module keeps is the record of what it **asked** to print through
`printing.jobs.create` (see below) — never the outcome.

Reprinting is done from wherever the document lives — the sale, the invoice, the kitchen ticket — not
from here.

## Asking the hub to print: `printing.jobs.create`

Anything that is not a screen — a flow, another module — prints through this command. It takes the
document in the shape the queue takes it (`jobId`, `documentType`, `document`, optional `role` and
`format`), keeps a record of the request and emits `printing.print.due`; the hub queues the job and
the device with the matching role prints it. `jobId` is the idempotency key: the same `jobId` twice
is **one** ticket, so a retried flow does not print twice. Kitchen tickets keep firing from the order
through `kitchen`'s stations — this door **complements** that path, it does not replace it.

## The receipt is not the fiscal document

The header and footer are **presentation**. The legal document is the invoice, produced by `invoice`,
and its number, its tax breakdown and its QR come from there.

Editing the footer does not change anything fiscal, and it cannot make an unregistered sale
compliant.

## Auto-print and the drawer are two separate decisions

- **Auto-print on sale** — a receipt comes out when a sale is charged.
- **Open drawer on sale** — the drawer-kick goes out with it.

You can have either without the other: a card-only counter may want the receipt and not the drawer; a
cash drawer may be opened without printing.

## Paper width is 80 or 58, and nothing else

Those are the two thermal roll sizes the module accepts. The value changes how the receipt is
laid out, so setting the wrong one produces a receipt that looks broken but prints fine.

## This module does not route anything

It used to look as if it did. There was a **Routing** tab, a table, a query and two commands mapping
a product category to `receipt` / `kitchen` / `bar` — and **nothing read any of it**, not since
ADR-0144 made the kitchen ticket fire from the order. printing#25 retired the whole surface.

Routing lives in `kitchen`, which is the module that owns stations:

| | `kitchen` (alive) | `printing` (retired in #25) |
|---|---|---|
| Concept | Real stations, each with a destination (screen, printer or both) and a printer role | A category mapped to `receipt` / `kitchen` / `bar` |
| Knows about products | Yes — explicit station, then product, then **category** | No — a category was a plain, unvalidated string |
| Who prints | The shell, grouped by printer role, so it prints even with the kitchen display closed | Nobody. That was the problem |

Since sales#12 the category of a sold line reaches `kitchen` for real (verified in kitchen#32), so
the capability the old tab promised exists — in the right place.

## An employee can print and open the drawer

Both are counter actions and both are granted to an employee. What an employee **cannot** do is
change the settings — that needs `printing.manage_settings`.

## The settings exist before the first Save

A new hub has no stored settings until somebody presses Save on the Printers screen, but reading
them still answers one set: the defaults — auto-print on sale **on**, drawer off, 80 mm, empty
header and footer. What the screen shows is what the till obeys, so the first sale of a new business
already prints its receipt (printing#42). Before that fix the screen showed auto-print on while the
till read nothing and printed nothing, silently, until a blank Save.

## Saving the settings brings them back

The settings are one row per hub. If that row ever ends up soft-deleted — an import, a reset, some
maintenance — saving from the screen **revives** it (printing#25). Before that fix the save reported
success, the form came back empty, and the `printing.setup` checklist item could never be ticked.

## The settings form saves everything at once

All the fields are required together. The screen sends the complete snapshot, so a partial update is
not a thing; whatever the form holds becomes the configuration.
