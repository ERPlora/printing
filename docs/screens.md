# Printing — Screens

The module contributes two tabs to the hub navigation: **Printers** and **Routing**.

## Printers — the printing settings

The receipt configuration, plus the network printers the local app has detected. Viewing requires
`printing.view_settings`; changing requires `printing.manage_settings`.

### Configure the receipt

1. Fill in the **receipt header** — your business details, the lines printed at the top.
2. Fill in the **receipt footer** — thanks, legal notice, opening hours.
3. Pick the **paper width**: **80 mm** or **58 mm**. Those are the only two values.
4. Decide **auto-print on sale**: print the receipt automatically when a sale is charged.
5. Decide **open drawer on sale**: send the drawer-kick with that receipt.
6. Decide **print kitchen**: whether kitchen lines are printed.
7. Save.

All seven fields are sent together — the form saves a complete snapshot, not one field at a time.

### Assign the printer

The list of printers is discovered by the ERPlora app on the device, not by this module. Which
printer is used, and whether it is reachable, is a property of that device.

## Routing — category to station

The rules that decide where a line is printed (`printing.routing.list`, 50 rows per page). Requires
`printing.view_routing`. Sorted by category.

- **Search** by category or station.
- **Filter** by station.

### Add or change a rule

1. Give the **product category** — a plain text name.
2. Pick the **station**: `receipt`, `kitchen` or `bar`.
3. Save.

Setting a rule for a category that already has one **replaces** it: one category maps to one station.
Requires `printing.manage_routing`.

### Remove a rule

Give the category. The rule disappears and that category stops being routed anywhere in particular.
Requires `printing.manage_routing`.

## Printing and opening the drawer

Both are actions the **device** performs, and both are permission-gated in the hub:

| Action | Permission |
|---|---|
| Print | `printing.print` |
| Open the cash drawer | `printing.open_drawer` |

An employee has both — printing a receipt and opening the drawer are counter actions.

Nothing about them is recorded here: there is no print history, no queue and no retry.
