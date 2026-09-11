-- ============================================================================
-- Bulgu Y-1 — organization_members politikasındaki sonsuz döngü (UYGULANDI)
-- ============================================================================
--
-- SORUN (2026-09-10'da politika metni okunarak teşhis edildi):
--   `organization_members` üzerindeki SELECT politikası KENDİ TABLOSUNDAN
--   okuyordu:
--
--     USING ( (visibility = 'members_only') AND EXISTS (
--               SELECT 1 FROM organization_members om
--               WHERE om.organization_id = organization_members.organization_id
--                 AND om.profile_id IN (SELECT id FROM profiles
--                                       WHERE user_id = auth.uid()) ))
--
--   Politika değerlendirilirken içteki SELECT aynı politikayı tekrar
--   tetikliyor → 42P17 "infinite recursion detected in policy".
--   Tablo her sorguda HTTP 500 veriyordu.
--
-- ÇÖZÜM:
--   Üyelik kontrolü, RLS'i baypas eden bir SECURITY DEFINER fonksiyona taşındı.
--   Fonksiyon içindeki okuma politika değerlendirmesi tetiklemediği için döngü
--   kırılır. Erişim kuralının ANLAMI aynen korundu: "bu kurumun üyesi misin?"
--
-- BAĞLAM:
--   `organization_members` ve `organization_admins` şu an 0 satır; uygulama
--   `members` tablosunu (9 satır) kullanıyor. Yani bunlar kullanılmayan eski
--   yapı — döngü gerçekti ama veri riski taşımıyordu. Yine de tablo doğru
--   çalışır halde bırakıldı; ileride kullanılırsa kural hazır.

create or replace function public.is_org_member_of(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.profiles p on p.id = om.profile_id
    where om.organization_id = p_org_id
      and p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member_of(uuid) from public, anon;
grant execute on function public.is_org_member_of(uuid) to authenticated;

drop policy if exists "Members can view their organization members" on public.organization_members;

-- Rol `public`ten `authenticated`a daraltıldı: politika zaten auth.uid()
-- gerektirdiği için anon hiçbir zaman geçemezdi; bu daraltma niyeti açık eder.
create policy "Members can view their organization members"
  on public.organization_members
  for select
  to authenticated
  using (
    visibility = 'members_only'
    and public.is_org_member_of(organization_id)
  );
