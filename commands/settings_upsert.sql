-- printing.settings.update — upsert del singleton (ON CONFLICT por el unique index de hub_id).
-- new_id/hub_id/current_user_id/now los inyecta el runtime.
INSERT INTO printing_settings (
    id, hub_id, receipt_header, receipt_footer, paper_width,
    auto_print_on_sale, open_drawer_on_sale, print_kitchen,
    is_deleted, created_by, updated_by, created_at, updated_at
) VALUES (
    :new_id, :hub_id, :receipt_header, :receipt_footer, :paper_width,
    :auto_print_on_sale, :open_drawer_on_sale, :print_kitchen,
    0, :current_user_id, :current_user_id, :now, :now
)
ON CONFLICT(hub_id) DO UPDATE SET
    receipt_header      = :receipt_header,
    receipt_footer      = :receipt_footer,
    paper_width         = :paper_width,
    auto_print_on_sale  = :auto_print_on_sale,
    open_drawer_on_sale = :open_drawer_on_sale,
    print_kitchen       = :print_kitchen,
    updated_by          = :current_user_id,
    updated_at          = :now;
