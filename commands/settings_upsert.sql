-- printing.settings.update — upsert del singleton (ON CONFLICT por el unique index de hub_id).
-- new_id/hub_id/current_user_id/now los inyecta el runtime.
--
-- El DO UPDATE **resucita** la fila (printing#25). `uq_printing_settings_hub` NO es un índice
-- parcial, así que una fila con is_deleted = 1 sigue ocupando la ranura del ON CONFLICT: sin estas
-- dos líneas, guardar sobre un singleton soft-borrado reportaba ÉXITO y dejaba is_deleted a 1,
-- `queries/settings_get.sql` filtra por is_deleted = 0 y el formulario volvía vacío. Peor: el ítem
-- de checklist `printing.setup` se decide con esa misma query, así que quedaba IMPOSIBLE de cerrar
-- por más veces que el comerciante pulsara Guardar. Su gemelo `routing_upsert.sql` sí resucitaba —
-- la diferencia no fue una decisión, fue un olvido.
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
    is_deleted          = 0,
    deleted_at          = NULL,
    updated_by          = :current_user_id,
    updated_at          = :now;
