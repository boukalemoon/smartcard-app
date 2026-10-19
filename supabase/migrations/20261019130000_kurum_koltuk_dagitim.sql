-- ============================================================================
-- Kurum koltukları — 2. ADIM: kota koruması ve dağıtım uçları
-- ============================================================================
--
-- 20261019110000 (1. adım) veri katmanını kurdu. Bu adım koltuk verme/alma
-- uçlarını açıyor. ÖNCE bir delik kapatılıyor.
--
-- ---------------------------------------------------------------------------
-- 0) AÇIK: kota kolonları korumasız kaldı (1. adımın hatası)
-- ---------------------------------------------------------------------------
-- organizations üzerinde "members_can_update_org" UPDATE politikası var ve
-- hassas kolonlar organizations_protect_system_columns tetikleyicisiyle
-- korunuyor (subscription_plan, subscription_status, bulk_discount_active,
-- member_count, created_by). 1. adımda eklediğim seat_quota / seat_plan /
-- seat_quota_expires_at O LİSTEYE EKLENMEDİ: kurum üyesi kendi kotasını
-- 999 ve kademesini 'corporate' yazabilirdi. Koltuk veren uç olmadığı için
-- henüz sömürülemiyordu; uç bu dosyada açıldığı için önce burası kapatılıyor.
--
-- Kota YALNIZ platform yöneticisi tarafından, admin_set_seat_quota ile
-- değişir (SECURITY DEFINER, current_user = postgres olduğu için tetikleyici
-- onu engellemez).

create or replace function public.organizations_protect_system_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_deneme text[] := '{}';
begin
  if current_user in ('authenticated', 'anon') then
    if new.subscription_plan    is distinct from old.subscription_plan    then v_deneme := v_deneme || 'subscription_plan'::text;    new.subscription_plan    := old.subscription_plan;    end if;
    if new.subscription_status  is distinct from old.subscription_status  then v_deneme := v_deneme || 'subscription_status'::text;  new.subscription_status  := old.subscription_status;  end if;
    if new.bulk_discount_active is distinct from old.bulk_discount_active then v_deneme := v_deneme || 'bulk_discount_active'::text; new.bulk_discount_active := old.bulk_discount_active; end if;
    if new.member_count         is distinct from old.member_count         then v_deneme := v_deneme || 'member_count'::text;         new.member_count         := old.member_count;         end if;
    if new.created_by           is distinct from old.created_by           then v_deneme := v_deneme || 'created_by'::text;           new.created_by           := old.created_by;           end if;
    -- KOLTUK KOTASI: para karşılığı verilen yetki. İstemci yazamaz.
    if new.seat_quota             is distinct from old.seat_quota             then v_deneme := v_deneme || 'seat_quota'::text;             new.seat_quota             := old.seat_quota;             end if;
    if new.seat_plan              is distinct from old.seat_plan              then v_deneme := v_deneme || 'seat_plan'::text;              new.seat_plan              := old.seat_plan;              end if;
    if new.seat_quota_expires_at  is distinct from old.seat_quota_expires_at  then v_deneme := v_deneme || 'seat_quota_expires_at'::text;  new.seat_quota_expires_at  := old.seat_quota_expires_at;  end if;

    if array_length(v_deneme, 1) > 0 then
      perform public.log_protected_write('organization', old.id::text, v_deneme);
    end if;
  end if;

  new.bulk_discount_active := coalesce(new.member_count, 0) >= 10;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Platform yöneticisi: kota tanımlar
-- ---------------------------------------------------------------------------
-- Toplu alım teklifle yürüyor; şirket teklifi kabul edip ödeyince kota burada
-- tanımlanır, dağıtımı şirket kendi yapar.
create or replace function public.admin_set_seat_quota(
  p_org_id     uuid,
  p_quota      int,
  p_plan       text,
  p_expires_at timestamptz,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_eski record; v_acik int; v_n int;
begin
  if not public.is_admin() then
    perform public.log_event('admin.set_seat_quota', auth.uid(), 'qrtim', 'organization',
                             p_org_id::text, 'denied', 'critical', 'internal',
                             jsonb_build_object('istenen_kota', p_quota));
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if p_quota is null or p_quota < 0 then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_kota');
  end if;

  -- Kota 0'dan büyükse kademe ve bitiş ZORUNLU. Süresiz yetki kazası
  -- olmasın (admin_set_plan'da aynı hata yaşandı).
  if p_quota > 0 then
    if p_plan is null or p_plan not in ('student','professional','stk','business','corporate') then
      return jsonb_build_object('ok', false, 'hata', 'gecersiz_plan');
    end if;
    if p_expires_at is null or p_expires_at <= now() then
      return jsonb_build_object('ok', false, 'hata', 'bitis_tarihi_gerekli');
    end if;
  end if;

  select o.seat_quota, o.seat_plan, o.seat_quota_expires_at, o.name
    into v_eski
    from public.organizations o where o.id = p_org_id;
  if v_eski is null then
    return jsonb_build_object('ok', false, 'hata', 'kurum_bulunamadi');
  end if;

  -- Kota DAĞITILMIŞ koltuk sayısının altına indirilemez: hangi koltuğun
  -- iptal edileceğine sunucu karar vermez, kurum yöneticisi önce geri alır.
  select count(*) into v_acik
    from public.org_seats s
   where s.organization_id = p_org_id and s.revoked_at is null and s.expires_at > now();

  if p_quota < v_acik then
    return jsonb_build_object('ok', false, 'hata', 'dagitilmis_koltuk_fazla',
                              'acik_koltuk', v_acik);
  end if;

  update public.organizations
     set seat_quota = p_quota,
         seat_plan = case when p_quota = 0 then null else p_plan end,
         seat_quota_expires_at = case when p_quota = 0 then null else p_expires_at end,
         updated_at = now()
   where id = p_org_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'hata', 'kurum_bulunamadi');
  end if;

  perform public.log_event('admin.set_seat_quota', auth.uid(), 'qrtim', 'organization',
                           p_org_id::text, 'success', 'critical', 'user',
                           jsonb_build_object('kurum', v_eski.name,
                                              'eski_kota', v_eski.seat_quota,
                                              'yeni_kota', p_quota,
                                              'eski_plan', v_eski.seat_plan,
                                              'yeni_plan', case when p_quota = 0 then null else p_plan end,
                                              'bitis', case when p_quota = 0 then null else p_expires_at end,
                                              'gerekce', p_reason));

  return jsonb_build_object('ok', true, 'kota', p_quota, 'acik_koltuk', v_acik);
end;
$$;

revoke all on function public.admin_set_seat_quota(uuid,int,text,timestamptz,text) from public, anon;
grant execute on function public.admin_set_seat_quota(uuid,int,text,timestamptz,text) to authenticated;

comment on function public.admin_set_seat_quota(uuid,int,text,timestamptz,text) is
  'Platform yoneticisi kurumun koltuk kotasini tanimlar. Kota 0 dan buyukse kademe ve bitis zorunlu; dagitilmis koltuk sayisinin altina indirilemez.';

-- ---------------------------------------------------------------------------
-- 2) Kurum yöneticisi: koltuk verir
-- ---------------------------------------------------------------------------
create or replace function public.org_seat_grant(
  p_org_id     uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ben    uuid := public.my_profile_id();
  v_org    record;
  v_acik   int;
  v_uye    boolean;
  v_seat   uuid;
begin
  if v_ben is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  -- Çağıran bu kurumun KABUL EDİLMİŞ yöneticisi olmalı.
  if not exists (
    select 1 from public.members m
     where m.organization_id = p_org_id and m.profile_id = v_ben
       and m.role in ('admin', 'owner') and m.accepted_at is not null
  ) then
    perform public.log_event('org.seat_grant', auth.uid(), 'qrtim', 'org_seat',
                             p_org_id::text, 'denied', 'warning', 'internal',
                             jsonb_build_object('hedef', p_profile_id));
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  select o.seat_quota, o.seat_plan, o.seat_quota_expires_at
    into v_org from public.organizations o where o.id = p_org_id;

  if v_org.seat_plan is null or coalesce(v_org.seat_quota, 0) = 0 then
    return jsonb_build_object('ok', false, 'hata', 'kota_yok');
  end if;
  if v_org.seat_quota_expires_at is null or v_org.seat_quota_expires_at <= now() then
    return jsonb_build_object('ok', false, 'hata', 'kota_suresi_doldu');
  end if;

  -- Hedef bu kurumun KABUL EDİLMİŞ üyesi olmalı: davet bekleyen kişiye
  -- koltuk verilmez (davetin kabul edilmiş gibi sayılması daha önce
  -- herkese açık kartta hataya yol açmıştı).
  select exists (
    select 1 from public.members m
     where m.organization_id = p_org_id and m.profile_id = p_profile_id
       and m.accepted_at is not null
  ) into v_uye;
  if not v_uye then
    return jsonb_build_object('ok', false, 'hata', 'uye_degil');
  end if;

  -- Kota denetimi. Satır kilidi: iki yönetici aynı anda son koltuğu
  -- vermeye çalışırsa ikisi de geçmesin.
  perform 1 from public.organizations where id = p_org_id for update;

  select count(*) into v_acik
    from public.org_seats s
   where s.organization_id = p_org_id and s.revoked_at is null and s.expires_at > now();

  if v_acik >= v_org.seat_quota then
    return jsonb_build_object('ok', false, 'hata', 'kota_dolu',
                              'kota', v_org.seat_quota, 'acik_koltuk', v_acik);
  end if;

  -- Koltuk kotadan UZUN yaşamaz.
  insert into public.org_seats (organization_id, profile_id, plan, expires_at, granted_by)
  values (p_org_id, p_profile_id, v_org.seat_plan, v_org.seat_quota_expires_at, v_ben)
  on conflict (organization_id, profile_id) where revoked_at is null do nothing
  returning id into v_seat;

  if v_seat is null then
    return jsonb_build_object('ok', false, 'hata', 'koltuk_zaten_var');
  end if;

  perform public.log_event('org.seat_grant', auth.uid(), 'qrtim', 'org_seat',
                           v_seat::text, 'success', 'critical', 'user',
                           jsonb_build_object('kurum', p_org_id, 'plan', v_org.seat_plan,
                                              'bitis', v_org.seat_quota_expires_at),
                           null, null, null, null,
                           (select user_id from public.profiles where id = p_profile_id));

  return jsonb_build_object('ok', true, 'plan', v_org.seat_plan,
                            'bitis', v_org.seat_quota_expires_at,
                            'acik_koltuk', v_acik + 1, 'kota', v_org.seat_quota);
end;
$$;

revoke all on function public.org_seat_grant(uuid,uuid) from public, anon;
grant execute on function public.org_seat_grant(uuid,uuid) to authenticated;

comment on function public.org_seat_grant(uuid,uuid) is
  'Kurum yoneticisi kabul edilmis uyeye koltuk verir. Kota asilamaz, koltuk kotadan uzun yasamaz.';

-- ---------------------------------------------------------------------------
-- 3) Kurum yöneticisi: koltuğu geri alır
-- ---------------------------------------------------------------------------
create or replace function public.org_seat_revoke(
  p_org_id     uuid,
  p_profile_id uuid,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ben uuid := public.my_profile_id(); v_seat uuid;
begin
  if v_ben is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  if not exists (
    select 1 from public.members m
     where m.organization_id = p_org_id and m.profile_id = v_ben
       and m.role in ('admin', 'owner') and m.accepted_at is not null
  ) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  update public.org_seats
     set revoked_at = now(), revoked_by = v_ben
   where organization_id = p_org_id and profile_id = p_profile_id
     and revoked_at is null
  returning id into v_seat;

  if v_seat is null then
    return jsonb_build_object('ok', false, 'hata', 'koltuk_bulunamadi');
  end if;

  -- Kişinin KENDİ aboneliğine dokunulmadı: koltuk kalkınca kendi planına
  -- döner, ücretsizse ücretsize. gecerli_plan() bunu kendiliğinden yapar.
  perform public.log_event('org.seat_revoke', auth.uid(), 'qrtim', 'org_seat',
                           v_seat::text, 'success', 'critical', 'user',
                           jsonb_build_object('kurum', p_org_id, 'gerekce', p_reason),
                           null, null, null, null,
                           (select user_id from public.profiles where id = p_profile_id));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.org_seat_revoke(uuid,uuid,text) from public, anon;
grant execute on function public.org_seat_revoke(uuid,uuid,text) to authenticated;

comment on function public.org_seat_revoke(uuid,uuid,text) is
  'Kurum yoneticisi koltugu geri alir. Kisinin kendi aboneligine dokunulmaz.';

-- ---------------------------------------------------------------------------
-- 4) Kurum panelinin okuduğu koltuk özeti
-- ---------------------------------------------------------------------------
create or replace function public.org_seats_list(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_ben uuid := public.my_profile_id(); v_org record; v_acik int; v_liste jsonb;
begin
  if v_ben is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  if not exists (
    select 1 from public.members m
     where m.organization_id = p_org_id and m.profile_id = v_ben
       and m.role in ('admin', 'owner') and m.accepted_at is not null
  ) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  select o.seat_quota, o.seat_plan, o.seat_quota_expires_at
    into v_org from public.organizations o where o.id = p_org_id;

  select count(*) into v_acik
    from public.org_seats s
   where s.organization_id = p_org_id and s.revoked_at is null and s.expires_at > now();

  -- Üye listesi + koltuk durumu. Kurum yöneticisi kime verdiğini görsün.
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', m.profile_id,
           'ad', coalesce(pr.name, m.name, m.email),
           'eposta', coalesce(pr.email, m.email),
           'koltuk_var', (s.id is not null),
           'koltuk_plan', s.plan,
           'koltuk_bitis', s.expires_at
         ) order by (s.id is null), coalesce(pr.name, m.name, m.email)), '[]'::jsonb)
    into v_liste
    from public.members m
    left join public.profiles pr on pr.id = m.profile_id
    left join public.org_seats s
           on s.organization_id = m.organization_id
          and s.profile_id = m.profile_id
          and s.revoked_at is null
          and s.expires_at > now()
   where m.organization_id = p_org_id and m.accepted_at is not null;

  return jsonb_build_object(
    'ok', true,
    'kota', coalesce(v_org.seat_quota, 0),
    'plan', v_org.seat_plan,
    'kota_bitis', v_org.seat_quota_expires_at,
    'acik_koltuk', v_acik,
    'kalan', greatest(coalesce(v_org.seat_quota, 0) - v_acik, 0),
    'uyeler', v_liste);
end;
$$;

revoke all on function public.org_seats_list(uuid) from public, anon;
grant execute on function public.org_seats_list(uuid) to authenticated;

comment on function public.org_seats_list(uuid) is
  'Kurum yoneticisi icin kota, kullanim ve uye bazli koltuk durumu.';
