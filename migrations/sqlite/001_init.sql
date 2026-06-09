-- printing: esquema inicial (SQLite). Contrato §2.5: hub_id + soft-delete + auditoría.
-- El rol→impresora física (qué impresora es "recibo"/"cocina") NO vive aquí: lo gestiona el
-- Bridge local (su devices.json, vía set_device_role). Aquí solo config de negocio del tenant.

-- Ajustes de impresión (singleton por hub).
CREATE TABLE IF NOT EXISTS printing_settings (
    id                  TEXT PRIMARY KEY,
    hub_id              TEXT NOT NULL,
    receipt_header      TEXT NOT NULL DEFAULT '',
    receipt_footer      TEXT NOT NULL DEFAULT '',
    paper_width         INTEGER NOT NULL DEFAULT 80,   -- 80 | 58 (mm)
    auto_print_on_sale  INTEGER NOT NULL DEFAULT 1,
    open_drawer_on_sale INTEGER NOT NULL DEFAULT 0,
    print_kitchen       INTEGER NOT NULL DEFAULT 0,    -- enrutar comandas a cocina/barra
    is_deleted INTEGER NOT NULL DEFAULT 0, deleted_at TEXT,
    created_by TEXT, updated_by TEXT, created_at TEXT, updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_printing_settings_hub ON printing_settings (hub_id);

-- Enrutado: categoría de producto → estación (receipt|kitchen|bar). Para cocina/multi-impresora.
CREATE TABLE IF NOT EXISTS printing_routing (
    id        TEXT PRIMARY KEY,
    hub_id    TEXT NOT NULL,
    category  TEXT NOT NULL,
    station   TEXT NOT NULL DEFAULT 'kitchen',   -- receipt|kitchen|bar
    is_deleted INTEGER NOT NULL DEFAULT 0, deleted_at TEXT,
    created_by TEXT, updated_by TEXT, created_at TEXT, updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_printing_routing_cat ON printing_routing (hub_id, category);
