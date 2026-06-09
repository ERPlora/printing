-- printing.routing.remove — soft-delete de una regla de enrutado por categoría.
UPDATE printing_routing
SET is_deleted = 1, deleted_at = :now, updated_by = :current_user_id, updated_at = :now
WHERE hub_id = :hub_id AND category = :category AND is_deleted = 0;
