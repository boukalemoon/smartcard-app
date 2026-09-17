-- ============================================================================
-- ADIM 3b — KURUM SAHİPLİĞİ + YETİM TEMİZLİĞİ
-- ============================================================================
--
-- SORUN: organizations tablosunda created_by kolonu YOKTU. Kurumun sahibi
-- yalnızca üyelik üzerinden biliniyordu; üyelik oluşmayınca (işlemsiz iki
-- adımlı yazma yüzünden) kurumun kime ait olduğu TAMAMEN kayboluyordu.
-- 24 yetim kurumun sahibini bu yüzden belirleyemedik.
--
-- Artık oluşturma atomik (create_organization) ama created_by ikinci bir
-- güvence: üyelik kaydı bir şekilde kaybolsa bile sahiplik kaybolmaz.
--
-- TEMİZLİK KARARI (kullanıcı onayıyla): A + B grupları silindi (20 kayıt).
--   A: aynı isimde sağlam kaydı olan kopyalar (Racoun ×4, TrendTech ×2, İlim ×1)
--   B: hiçbir denemesi tutmamışlar (CODLEAN ×4, Uluoğlu ×4, Test ×3, M.Karasu ×2)
-- C grubu KORUNDU: Espor İşverenleri Sendikası (3 başvurusu var), Esis, Pega,
--   Türkiye Gençlik Derneği — bunlara ayrıca karar verilecek.
--
-- Doğrulandı: 33 -> 13 kurum, 24 -> 4 yetim, 0 başvuru etkilendi,
-- 0 yetim üyelik, mükerrer isim 7 -> 0.

alter table public.organizations
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

comment on column public.organizations.created_by is
  'Kurumu oluşturan profil. Üyelik kaydından bağımsız ikinci sahiplik izi.';

update public.organizations o
set created_by = m.profile_id
from public.members m
where m.organization_id = o.id and m.role = 'admin' and o.created_by is null;

-- create_organization artık created_by dolduruyor (tam gövde için
-- 20260912140000_atomic_org_creation.sql; burada yalnızca insert satırı değişti)
create or replace function public.create_organization(
  p_name text, p_type text default 'company', p_description text default null,
  p_website text default null, p_email text default null, p_phone text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid; v_plan text; v_limit int; v_count int; v_org uuid;
begin
  select p.id into v_profile_id from public.profiles p where p.user_id = auth.uid();
  if v_profile_id is null then return jsonb_build_object('ok', false, 'hata', 'profil_yok'); end if;
  if p_name is null or btrim(p_name) = '' then return jsonb_build_object('ok', false, 'hata', 'ad_zorunlu'); end if;

  if exists (select 1 from public.members m join public.organizations o on o.id = m.organization_id
             where m.profile_id = v_profile_id and lower(btrim(o.name)) = lower(btrim(p_name))) then
    return jsonb_build_object('ok', false, 'hata', 'ayni_isim_var');
  end if;

  select coalesce(s.plan,'free') into v_plan from public.subscriptions s where s.profile_id = v_profile_id;
  v_limit := case coalesce(v_plan,'free')
    when 'free' then 2 when 'student' then 1 when 'professional' then 999
    when 'stk' then 999 when 'business' then 999 when 'corporate' then 999 else 2 end;
  select count(*) into v_count from public.members m where m.profile_id = v_profile_id;
  if v_count >= v_limit then
    return jsonb_build_object('ok', false, 'hata', 'limit_asildi', 'limit', v_limit, 'mevcut', v_count);
  end if;

  insert into public.organizations (name, type, description, website, email, phone, created_by)
  values (btrim(p_name), coalesce(p_type,'company'), p_description, p_website, p_email, p_phone, v_profile_id)
  returning id into v_org;

  insert into public.members (organization_id, profile_id, role, name, email, status)
  select v_org, v_profile_id, 'admin', p.name, p.email, 'active'
  from public.profiles p where p.id = v_profile_id;

  return jsonb_build_object('ok', true, 'id', v_org);
end; $$;
revoke all on function public.create_organization(text,text,text,text,text,text) from public, anon;
grant execute on function public.create_organization(text,text,text,text,text,text) to authenticated;

-- Yetim temizliği (A + B)
delete from public.organizations o
where not exists (select 1 from public.members m where m.organization_id = o.id)
  and o.name not in ('Espor İşverenleri Sendikası','Esis','Pega','Türkiye Gençlik Derneği');
