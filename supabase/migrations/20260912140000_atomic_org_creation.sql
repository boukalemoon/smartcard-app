-- ============================================================================
-- ADIM 3 — ATOMİK KURUM OLUŞTURMA + KOLON VARSAYILANLARI
-- ============================================================================
--
-- SORUN 1 (kanıtlandı): Kurum oluşturma iki ayrı yazma yapıyordu, arada işlem
-- yoktu. İkinci adım (kurucuyu üye ekleme) patlayınca kurum kaydı zaten
-- kaydedilmiş oluyordu. Arayüz kurumları üyelik üzerinden listelediği için
-- kullanıcı hiçbir şey görmüyor, tekrar deniyordu. Her deneme bir yetim kurum:
-- 33 kurumun 24'ü (%73) böyle oluşmuş.
--   CODLEAN: 11sn / 63sn / 8sn arayla 4 deneme, dördünde de üye sayısı 0.
--
-- SORUN 2: Kurum limiti YALNIZCA istemcide kontrol ediliyordu; API'den
-- doğrudan sınırsız kurum açılabilirdi. Ayrıca PLAN_ORG_LIMITS'te 'corporate'
-- tanımsızdı -> en üst plana ödeyen kullanıcı 2 kurumla sınırlanıyordu.
--
-- SORUN 3: members kolon varsayılanları aşırı kaçışla yazılmış:
--   status default '''active'''::text   -> değer: 'active' (tırnaklarıyla)
-- Bu yüzden .eq('status','active') filtreleri hiçbir satırı tutmuyordu; üye
-- dizini boş görünüyordu. Düzeltme sonrası status='active' 9 satır tutuyor.
--
-- Doğrulandı (geri alınan işlemde, 5 senaryo):
--   normal oluşturma -> ok, üye otomatik 1 · aynı isim -> ayni_isim_var
--   boş ad -> ad_zorunlu · limit -> limit_asildi (sunucuda)

create or replace function public.create_organization(
  p_name        text,
  p_type        text default 'company',
  p_description text default null,
  p_website     text default null,
  p_email       text default null,
  p_phone       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_plan  text;
  v_limit int;
  v_count int;
  v_org   uuid;
begin
  select p.id into v_profile_id from public.profiles p where p.user_id = auth.uid();
  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  if p_name is null or btrim(p_name) = '' then
    return jsonb_build_object('ok', false, 'hata', 'ad_zorunlu');
  end if;

  if exists (
    select 1 from public.members m
    join public.organizations o on o.id = m.organization_id
    where m.profile_id = v_profile_id
      and lower(btrim(o.name)) = lower(btrim(p_name))
  ) then
    return jsonb_build_object('ok', false, 'hata', 'ayni_isim_var');
  end if;

  select coalesce(s.plan, 'free') into v_plan
  from public.subscriptions s where s.profile_id = v_profile_id;

  v_limit := case coalesce(v_plan, 'free')
    when 'free' then 2 when 'student' then 1
    when 'professional' then 999 when 'stk' then 999
    when 'business' then 999 when 'corporate' then 999
    else 2 end;

  select count(*) into v_count from public.members m where m.profile_id = v_profile_id;
  if v_count >= v_limit then
    return jsonb_build_object('ok', false, 'hata', 'limit_asildi',
                              'limit', v_limit, 'mevcut', v_count);
  end if;

  insert into public.organizations (name, type, description, website, email, phone)
  values (btrim(p_name), coalesce(p_type,'company'), p_description, p_website, p_email, p_phone)
  returning id into v_org;

  insert into public.members (organization_id, profile_id, role, name, email, status)
  select v_org, v_profile_id, 'admin', p.name, p.email, 'active'
  from public.profiles p where p.id = v_profile_id;

  return jsonb_build_object('ok', true, 'id', v_org);
end;
$$;

revoke all on function public.create_organization(text,text,text,text,text,text) from public, anon;
grant execute on function public.create_organization(text,text,text,text,text,text) to authenticated;

comment on function public.create_organization(text,text,text,text,text,text) is
  'Kurum + kurucu üyelik TEK işlemde. Limit ve mükerrer isim kontrolü sunucuda. Yetim kurum üretmez.';

-- Kolon varsayılanlarındaki fazladan tırnaklar
alter table public.members alter column name   set default 'Üye';
alter table public.members alter column email  set default null;
alter table public.members alter column status set default 'active';

-- Mevcut satırlardaki tırnakları temizle
update public.members
set name   = btrim(btrim(name), ''''),
    status = btrim(btrim(status), ''''),
    email  = nullif(btrim(btrim(coalesce(email,'')), ''''), '')
where name like '''%' or status like '''%' or email like '''%';
