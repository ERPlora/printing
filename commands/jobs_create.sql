-- printing.jobs.create — record the print request; the `emit` of this command
-- (`printing.print.due`) carries the intention {jobId, role, documentType, document, format}
-- to the hub's listener-host `host.print`, which enqueues it (ADR-0349, hub#957).
-- Same jobId again is a harmless replay: the queue dedups (ON CONFLICT DO NOTHING) and so do we.
-- new_id/hub_id/current_user_id/now are injected by the runtime.
INSERT INTO printing_jobs (
    id, hub_id, job_id, document_type, role, format,
    is_deleted, created_by, updated_by, created_at, updated_at
) VALUES (
    :new_id, :hub_id, :jobId, :documentType, :role, :format,
    0, :current_user_id, :current_user_id, :now, :now
)
ON CONFLICT (hub_id, job_id) DO NOTHING;
