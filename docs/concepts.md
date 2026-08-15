# Printing — Concepts

The things people get wrong on their first day.

## Settings live in the hub; printing happens on the device

The hub stores **what should be printed and how**. The **device** running the ERPlora app does the
printing and opens the drawer.

That split explains almost every question about this module:

- Changing the header here changes what the **next** receipt says, everywhere.
- A printer that does not respond is a **device** problem; nothing in these settings fixes it.
- Two tills can share the same settings and have completely different printers.

## Nothing is queued, retried or recorded

There is no print spool, no retry, no log of what came out. If a receipt fails to print, the hub does
not know and will not try again.

Reprinting is done from wherever the document lives — the sale, the invoice, the kitchen ticket — not
from here.

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

## One category, one station

A routing rule maps a **product category** to one of `receipt`, `kitchen` or `bar`. Setting a rule for
a category that already has one **replaces** it — there is no list of stations per category.

A category with no rule is simply not routed by this module.

## A category here is a plain string

It is **not** a reference to a category in the product catalogue. Nothing validates it, nothing links
to it, and renaming a category in `inventory` does **not** update the rule here.

That is deliberate: the module depends on nothing and must work with or without a catalogue. The cost
is that a typo silently produces a rule that never matches.

## If `kitchen` is installed, its stations are the real ones

There are two overlapping mechanisms in the product, and knowing which one is acting matters:

| | This module | `kitchen` |
|---|---|---|
| Concept | A category mapped to `receipt` / `kitchen` / `bar` | Real stations, each with a destination (screen, printer or both) and a printer role |
| Who prints | The device | The shell, grouped by printer role |
| Knows about products | No — a category is a string | Yes, routing is per product |

With `kitchen` installed, kitchen printing is driven by **its** stations. This module's routing is the
simpler, older path.

## An employee can print and open the drawer

Both are counter actions and both are granted to an employee. What an employee **cannot** do is change
the settings or the routing rules — those need the manage permissions.

## The settings form saves everything at once

All the fields are required together. The screen sends the complete snapshot, so a partial update is
not a thing; whatever the form holds becomes the configuration.
