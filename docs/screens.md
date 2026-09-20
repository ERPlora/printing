# Printing — Screens

The module contributes **one** tab to the hub navigation: **Printers**.

## Printers — the printing settings

The receipt configuration, plus the network printers the local app has detected. Viewing requires
`printing.view_settings`; changing requires `printing.manage_settings`.

### Configure how it prints

1. Pick the **paper width**: **80 mm** or **58 mm**. Those are the only two values.
2. Decide **auto-print on sale**: print the receipt automatically when a sale is charged.
3. Decide **open drawer on sale**: send the drawer-kick with that receipt.
4. Save.

The form saves a complete snapshot, not one field at a time. There is no «print kitchen» switch:
the kitchen ticket fires from the order and is routed by `kitchen`'s stations (ADR-0144).

### What the receipt says is configured in Sales

The **header** and the **footer** of the ticket are part of your till settings, and the screen
links straight to them. They used to be two boxes here; what was typed in them never reached the
paper once both tickets started being printed from the till settings, so they were removed.

If you had written something here, the screen shows it with a button that **moves it over** to the
receipt settings. It only ever fills what is still empty there: a header you already wrote in Sales
is never overwritten. If the move cannot be made — the Sales app is not installed, or your account
may not change its settings — the text stays on screen so you can copy it across by hand.

### Assign the printer

The list of printers is discovered by the ERPlora app on the device, not by this module. Which
printer is used, and whether it is reachable, is a property of that device.

## Routing — retired (printing#25)

There used to be a **Routing** tab here where you assigned product categories to stations. It is
gone, and nothing is lost: **nothing ever read those rules**, and had not since ADR-0144 moved the
kitchen ticket to fire from the order.

**Where to route by category now:** `kitchen` → **Stations**. That is the module that owns stations,
and the category of a sold line reaches it for real (sales#12, verified in kitchen#32). Its routing
is richer than this one was — explicit station, then product, then category — and, unlike the old
tab, it works.

The `printing_routing` table is kept so nobody's old configuration is destroyed, but nothing in the
product can reach it.

## Printing and opening the drawer

Both are actions the **device** performs, and both are permission-gated in the hub:

| Action | Permission |
|---|---|
| Print | `printing.print` |
| Open the cash drawer | `printing.open_drawer` |

An employee has both — printing a receipt and opening the drawer are counter actions.

Nothing about them is recorded here: there is no print history, no queue and no retry.
