-- Fix: Remove SECURITY DEFINER behaviour from views in public schema
--
-- Views without security_invoker = on run with the permissions of the view
-- owner (effectively SECURITY DEFINER), bypassing RLS policies for the
-- querying user.  Setting security_invoker = on forces the view to execute
-- under the permissions of the calling user, so RLS is enforced correctly.
--
-- Supabase lint reference: security_definer_view (0010)

ALTER VIEW public.trial_nurture_email_stats   SET (security_invoker = on);
ALTER VIEW public.trial_job_status            SET (security_invoker = on);
ALTER VIEW public.generated_content_with_users SET (security_invoker = on);
