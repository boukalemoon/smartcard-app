-- Güvenlik: Ülgen Supabase tabloları terk edilmiş (ulgen_agent_reports son yazma
-- 2026-05-30, ulgen_profile/memory/sources 2026-04-24). Ülgen SQLite + Firestore'a
-- geçmiş; Supabase kapsam dışı bırakılmış. anon 'ALL USING(true)' politikaları
-- herkese okuma/güncelleme/silme veriyordu (public anon key ile 2144 satır silinebilirdi).
-- Politikaları kaldır -> RLS açık + politika yok => yalnızca service_role erişir.
-- Veri silinmez; gerekirse politikalar geri eklenebilir.

drop policy if exists "ulgen_agent_reports_anon_all" on public.ulgen_agent_reports;

drop policy if exists "ulgen_memory_anon_all" on public.ulgen_memory;

drop policy if exists "ulgen_sources_anon_all" on public.ulgen_sources;

drop policy if exists "ulgen_profile_anon_insert" on public.ulgen_profile;
drop policy if exists "ulgen_profile_anon_read"   on public.ulgen_profile;
drop policy if exists "ulgen_profile_anon_update" on public.ulgen_profile;
