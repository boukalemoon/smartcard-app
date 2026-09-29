-- ============================================================================
-- BEKLEYEN — henüz UYGULAMAYIN
-- ============================================================================
--
-- Ne zaman: tüm admin/superadmin hesapları doğrulama uygulamasını (TOTP)
-- kurduktan SONRA. Kontrol:
--
--   select p.email, coalesce(u.totp_enrolled, false) as totp
--   from public.profiles p
--   left join public.shieldauth_mfa_users u on u.user_id = p.user_id
--   where p.role in ('admin', 'superadmin');
--
-- Hepsinde totp = true değilse uygulanırsa o yöneticiler yetkisini kaybeder.
-- Acil durum: service_role ile shieldauth_mfa_users satırı düzenlenebilir veya
-- 20260929090000_shieldauth_mfa.sql içindeki is_admin() yeniden uygulanır.
--
-- Sonra: yönetici olmak = rol + TOTP kurulu + son 12 saatte doğrulama.
-- Uygulanınca supabase/migrations altına tarihli bir dosya olarak taşıyın.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and role in ('admin', 'superadmin')
  )
  and public.shieldauth_mfa_enrolled(auth.uid())
  and public.shieldauth_mfa_fresh(interval '12 hours');
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
