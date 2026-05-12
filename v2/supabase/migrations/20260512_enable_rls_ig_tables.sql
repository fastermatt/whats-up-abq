-- Migration: enable RLS on ig_post_log and ig_scheduled_posts
-- Date: 2026-05-12
-- Reason: Supabase security advisor flagged both tables as publicly accessible
--         (rowsecurity=false). These are admin-only tables accessed exclusively
--         via the service-role client in /api/admin/ig/* routes. The service
--         role bypasses RLS automatically, so no permissive policies are needed.
--
-- Applied directly via Supabase MCP on 2026-05-12.

ALTER TABLE public.ig_post_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: explicit deny for all public/anon/authenticated access.
CREATE POLICY "deny_all_ig_post_log"
  ON public.ig_post_log
  FOR ALL TO public
  USING (false);

CREATE POLICY "deny_all_ig_scheduled_posts"
  ON public.ig_scheduled_posts
  FOR ALL TO public
  USING (false);
