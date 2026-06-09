-- printing.routing.list — el runtime aplica search/sort/filtros/paginación e inyecta :hub_id.
-- (query de lista: sin ORDER BY/LIMIT ni ';' final).
SELECT id, category, station, created_at
FROM printing_routing
WHERE hub_id = :hub_id AND is_deleted = 0
