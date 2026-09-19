-- printing.settings.get — the hub's printing settings singleton (the runtime injects :hub_id).
--
-- ALWAYS ONE ROW (printing#42). Selecting FROM `printing_settings` answered ZERO rows on a hub that
-- had never pressed Save on the Printers screen — every salon built from a blueprint. The screen
-- painted its own defaults and showed «Print receipt on sale: ON», while the shell's print-on-sale
-- listener took the first row, found none and printed nothing, silently. The single-row anchor
-- LEFT JOINs this hub's stored settings and, when there are none (or the singleton is soft-deleted),
-- answers the table's own DDL defaults, so the screen and the till read the same thing. Reading
-- never writes a row. Same pattern as `verifactu.config.get` (verifactu#107).
SELECT ps.id,
       COALESCE(ps.receipt_header, '')         AS receipt_header,
       COALESCE(ps.receipt_footer, '')         AS receipt_footer,
       COALESCE(ps.paper_width, 80)            AS paper_width,
       COALESCE(ps.auto_print_on_sale, 1)      AS auto_print_on_sale,
       COALESCE(ps.open_drawer_on_sale, 0)     AS open_drawer_on_sale,
       COALESCE(ps.print_kitchen, 0)           AS print_kitchen
FROM (SELECT 1 AS singleton) anchor
LEFT JOIN printing_settings ps
       ON ps.hub_id = :hub_id AND ps.is_deleted = 0
LIMIT 1;
