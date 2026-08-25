-- The local E2E schema preflight reads through the service-role API key.
-- Keep the canonical change cursor visible to that trusted server-side role
-- after the canonical contract migration revokes PUBLIC access.
GRANT SELECT ON TABLE public.canonical_change_log TO service_role;
