-- Tetikleyici fonksiyonlarının API yüzeyinden kaldırılması (20260921120000)
revoke all on function public.social_links_limit_guard() from public, anon, authenticated;
revoke all on function public.profiles_username_history() from public, anon, authenticated;
revoke all on function public.ilgezdi_profiles_protect() from public, anon, authenticated;
revoke all on function public.guard_profile_privileged_columns() from public, anon, authenticated;
revoke all on function public.sync_org_member_count() from public, anon, authenticated;
revoke all on function public.prevent_last_admin_removal() from public, anon, authenticated;
