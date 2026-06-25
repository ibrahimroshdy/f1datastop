-- Address Supabase advisor "Security Definer View" on the f1 reference views.
-- SECURITY DEFINER views run with the owner's privileges and bypass the caller's
-- RLS. These views expose public reference data only, and every underlying f1_*
-- table carries a public_read SELECT policy (roles {anon, authenticated}, using
-- true), so running them as the querying user (security_invoker) is safe and
-- closes the advisor finding.
alter view public.f1_v_schedule set (security_invoker = on);
alter view public.f1_driver_profile set (security_invoker = on);
alter view public.f1_constructor_profile set (security_invoker = on);
