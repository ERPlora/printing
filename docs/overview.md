# Printing — Overview

## What this module does

Printing holds the **printing configuration** of the hub: what goes on the receipt header and footer,
the paper width, whether a receipt prints automatically when a sale is charged, whether the cash
drawer opens with it, and which **station** each product category is routed to.

That is the whole module. It is small on purpose.

## The module configures printing; it does not print

This is the single most important thing to understand.

**No printing happens inside this module.** It stores the receipt settings. The actual printing
— and opening the cash drawer — is done **client-side**, by the ERPlora app running on the device
that owns the printer.

So a page not coming out is almost never a problem with these settings; it is a problem with the
device, the printer or the connection.

## What this module does NOT do

- **It does not print or open a drawer.** It only says what should happen.
- **It does not discover printers.** Discovery is done by the local app.
- **It does not route anything.** The Routing tab, its table, its query and its two commands were
  retired in printing#25: nothing had read them since ADR-0144. Routing by category is `kitchen` →
  **Stations**, which owns stations for real and does apply them (sales#12, kitchen#32).
- **It does not know about products or categories.** It has no reason to any more.
- **It does not queue anything.** There is no retry, no spool, no history of what was printed.
- **It does not print labels today**, despite the keyword. <!-- TODO: verify -->

## Modules it connects to

**Depends on nothing**, and nothing depends on it. It listens to none. It emits **one** event,
`printing.print.due`: the print intention behind `printing.jobs.create`, which the hub's own
listener-host turns into a job in the print queue. That command is how a flow (or another module)
puts paper out without owning a printer.

That isolation is deliberate: the module has to work whether or not a catalogue exists.

> ℹ️ **There used to be two overlapping routing mechanisms and only one worked.** `kitchen` has the
> real station model — a destination (screen, printer or both) and a printer role per station — and
> the kitchen ticket is printed by the shell, so it comes out even with the kitchen display closed.
> This module's copy was retired in printing#25.

## The vocabulary

| Concept | Meaning |
|---|---|
| **Printer role** | What a device's printer is for: `receipt`, `kitchen`, `bar` or `label`. A property of the DEVICE, not of a rule here |
| **Paper width** | 80 mm or 58 mm |
| **Auto-print on sale** | Print the receipt automatically when a sale is charged |
| **Open drawer on sale** | Send the drawer-kick signal with that receipt |

## First-run setup

Printing contributes an **optional** setup step called **"Your printer"**: *Put your business details
on the receipt and assign the printer that prints it.* It is considered done once the receipt header
has been filled in, and it needs `printing.manage_settings`.
