-- printing.routing.set — asigna estación a una categoría (upsert por unique (hub_id, category)).
INSERT INTO printing_routing (
    id, hub_id, category, station,
    is_deleted, created_by, updated_by, created_at, updated_at
) VALUES (
    :new_id, :hub_id, :category, :station,
    0, :current_user_id, :current_user_id, :now, :now
)
ON CONFLICT(hub_id, category) DO UPDATE SET
    station     = :station,
    is_deleted  = 0,
    deleted_at  = NULL,
    updated_by  = :current_user_id,
    updated_at  = :now;
