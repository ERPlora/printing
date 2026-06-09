-- printing.settings.get — el singleton de ajustes de impresión del hub (runtime inyecta :hub_id).
SELECT id, receipt_header, receipt_footer, paper_width,
       auto_print_on_sale, open_drawer_on_sale, print_kitchen
FROM printing_settings
WHERE hub_id = :hub_id AND is_deleted = 0;
