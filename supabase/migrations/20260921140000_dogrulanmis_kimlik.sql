-- ============================================================================
-- DOĞRULANMIŞ KİMLİK (ROZET)
-- ============================================================================
--
-- NEDEN: QRtım artık dijital kimlik. Kartı gören kişinin sorusu "bu tasarım
-- güzel mi" değil, "bu kişi gerçekten söylediği kişi mi". Bugün kartta bu
-- soruya cevap veren hiçbir şey yok.
--
-- TASARIM KARARI — rozet genel bir "onaylı" tiki DEĞİLDİR.
--   Twitter tarzı tek mavi tik "biz bu kişiye kefiliz" der; bizim böyle bir
--   kefil olma yetimiz yok. Bunun yerine her rozet NE doğrulandığını söyler:
--     "ornek.com.tr alan adı doğrulandı"   değil   "onaylı hesap".
--   Kartta doğrulama tarihi de görünür; ziyaretçi tazeliğine kendi karar verir.
--
-- NE ROZET OLUR, NE OLMAZ:
--   • Alan adı (DNS TXT)  → ROZET. Ücretsiz, kendi kendine yapılır, güçlü ve
--     nadir. Esnaf ve kurum için en anlamlı sinyal.
--   • Kurum üyeliği       → ROZET, ama SAKLANMAZ; üyelikten TÜRETİLİR (aşağıda).
--   • E-posta             → ROZET DEĞİL. Kayıt olan herkeste var; herkeste olan
--     bir işaret hiçbir şey ayırt etmez, sadece rozeti değersizleştirir.
--     Doğrulama ayrıntısında satır olarak görünür.
--   • Telefon / resmi kimlik → şema hazır, akış KAPALI. İkisi de dış sağlayıcı
--     (SMS / kimlik sağlayıcı) ve sözleşme gerektiriyor; ödeme işiyle birlikte
--     en sona bırakıldı. Yarım bir doğrulamayı "doğrulandı" diye göstermeyiz.
--
-- KURUM ÜYELİĞİ NEDEN SAKLANMIYOR:
--   Saklanan rozet, gerçek bittikten sonra yaşamaya devam eder: kişi işten
--   ayrılır, kartı hâlâ "ESİS üyesi" der. Üyelik satırından TÜRETİLDİĞİ için
--   üyelik bitince rozet de aynı anda biter. Doğruluğu koda değil veriye bağlı.

-- ---------------------------------------------------------------------------
-- 0) ÖNCE BİR DELİK: kart, kabul edilmemiş daveti üyelik gibi gösteriyordu
-- ---------------------------------------------------------------------------
-- build_public_card kurumları listelerken accepted_at'e bakmıyordu. Davet
-- akışı (20260920105311) üyeliği onaya bağladı ama KART güncellenmedi:
-- herhangi bir kurum yöneticisi bir e-posta yazarak o kişinin herkese açık
-- kartında kendi kurumunu gösterebilirdi — kişi daveti hiç görmeden.
-- Henüz kimse bekleyen davette değil (10/10 kabul edilmiş), yani kötüye
-- kullanılmadı; ilk davetle birlikte gerçek olacaktı.
-- Düzeltme build_public_card'ın yeni sürümünde (aşağıda).

-- ---------------------------------------------------------------------------
-- 1) Doğrulama kayıtları
-- ---------------------------------------------------------------------------
create table if not exists public.identity_verifications (
  id               uuid primary key default gen_random_uuid(),

  -- Sahip ya bir kişi ya bir kurumdur, ikisi birden değil.
  profile_id       uuid references public.profiles(id) on delete cascade,
  organization_id  uuid references public.organizations(id) on delete cascade,

  tur              text not null check (tur in ('alan_adi','telefon','resmi_kimlik','sosyal_hesap')),
  konu             text not null check (char_length(konu) between 3 and 253),

  durum            text not null default 'beklemede'
                   check (durum in ('beklemede','dogrulandi','basarisiz','iptal')),
  yontem           text check (yontem in ('dns_txt','well_known','otp_sms','kimlik_saglayici','manuel')),

  -- DNS'e yazılacak değer. GİZLİ DEĞİLDİR: zaten herkese açık bir kayda
  -- yazılıyor. Güvenlik, değerin gizliliğinden değil, o kaydı yalnızca alan
  -- adının sahibinin yazabilmesinden geliyor.
  meydan_okuma     text,

  kanit            jsonb not null default '{}'::jsonb,
  deneme_sayisi    int not null default 0,
  son_deneme_at    timestamptz,

  dogrulandi_at    timestamptz,
  -- Alan adı el değiştirebilir; doğrulama süresiz değildir. Süresi geçmiş
  -- doğrulama kartta GÖSTERİLMEZ (sessizce doğru kalmak yerine görünmez olur).
  gecerlilik_bitis timestamptz,

  iptal_at         timestamptz,
  iptal_nedeni     text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint identity_verifications_sahip_chk
    check ((profile_id is not null) <> (organization_id is not null)),
  -- "doğrulandı" demek için tarih ve yöntem zorunlu: kanıtsız rozet olmaz.
  constraint identity_verifications_kanit_chk
    check (durum <> 'dogrulandi' or (dogrulandi_at is not null and yontem is not null))
);

-- Aynı sahip + tür + konu için tek canlı kayıt.
create unique index if not exists identity_verifications_canli_key
  on public.identity_verifications (coalesce(profile_id, organization_id), tur, konu)
  where iptal_at is null;

create index if not exists identity_verifications_profil_idx
  on public.identity_verifications (profile_id) where durum = 'dogrulandi';
create index if not exists identity_verifications_kurum_idx
  on public.identity_verifications (organization_id) where durum = 'dogrulandi';

alter table public.identity_verifications enable row level security;

comment on table public.identity_verifications is
  'Kimlik doğrulama kayıtları. Her satır BELİRLİ bir iddianın kanıtıdır; genel bir "onaylı" işareti değildir.';

-- Sahibi kendi kayıtlarını görür. Yazma YALNIZCA RPC ile (aşağıdaki definer
-- fonksiyonlar): istemci "durum = dogrulandi" yazamaz.
create policy "sahibi dogrulamalarini gorur" on public.identity_verifications
  for select to authenticated
  using (
    profile_id = public.my_profile_id()
    or (organization_id is not null and public.is_admin_of_org(organization_id))
    or public.is_admin()
  );

revoke insert, update, delete on public.identity_verifications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Alan adı normalleştirme
-- ---------------------------------------------------------------------------
-- Kullanıcı "https://www.Ornek.com.tr/iletisim" yazar; biz "ornek.com.tr"
-- üzerinde çalışırız. Aksi halde aynı alan adı için birden çok kayıt oluşur
-- ve hangisinin doğrulandığı belirsizleşir.
create or replace function public.normalize_domain(p_text text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(btrim(coalesce(p_text, ''))), '^[a-z]+://', ''),
        '[/?#].*$', ''),
      '^www\.', ''),
    '');
$fn$;

create or replace function public.is_valid_domain(p_domain text)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select p_domain is not null
     and char_length(p_domain) between 4 and 253
     and p_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
     -- Tamamen sayısal son ek (IP benzeri) alan adı değildir.
     and p_domain !~ '^[0-9.]+$';
$fn$;

-- ---------------------------------------------------------------------------
-- 3) Doğrulama başlat (alan adı)
-- ---------------------------------------------------------------------------
create or replace function public.verification_start_domain(
  p_domain text,
  p_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_prof uuid := public.my_profile_id();
  v_dom  text := public.normalize_domain(p_domain);
  v_tok  text;
  v_id   uuid;
  v_var  public.identity_verifications;
begin
  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  if not public.is_valid_domain(v_dom) then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_alan_adi');
  end if;

  -- Kurum adına doğrulama yalnızca kurum yöneticisinden.
  if p_org_id is not null and not public.is_admin_of_org(p_org_id) then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;

  if not public.check_rate_limit('dogrulama-baslat:' || v_prof::text, 10, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  -- Zaten canlı bir kayıt varsa onu kullan; her tıklamada yeni değer üretmek
  -- kullanıcının DNS'e yeni yazdığı kaydı geçersizleştirirdi.
  select * into v_var
    from public.identity_verifications
   where tur = 'alan_adi' and konu = v_dom and iptal_at is null
     and coalesce(profile_id, organization_id) = coalesce(p_org_id, v_prof)
   limit 1;

  if v_var.id is not null then
    if v_var.durum = 'dogrulandi'
       and (v_var.gecerlilik_bitis is null or v_var.gecerlilik_bitis > now()) then
      return jsonb_build_object('ok', true, 'zaten_dogrulandi', true,
                                'id', v_var.id, 'alan_adi', v_dom);
    end if;
    return jsonb_build_object('ok', true, 'id', v_var.id, 'alan_adi', v_dom,
                              'kayit_adi', v_dom, 'kayit_turu', 'TXT',
                              'kayit_degeri', v_var.meydan_okuma);
  end if;

  v_tok := 'qrtim-dogrulama=' || encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.identity_verifications
    (profile_id, organization_id, tur, konu, durum, yontem, meydan_okuma)
  values
    (case when p_org_id is null then v_prof end, p_org_id,
     'alan_adi', v_dom, 'beklemede', 'dns_txt', v_tok)
  returning id into v_id;

  perform public.log_event('verification.started', auth.uid(), 'qrtim',
                           'identity_verification', v_id::text,
                           'success', 'notice', 'user',
                           jsonb_build_object('tur', 'alan_adi', 'konu', v_dom,
                                              'kurum', p_org_id),
                           'user', null, public.request_client_ip(), null, auth.uid());

  return jsonb_build_object('ok', true, 'id', v_id, 'alan_adi', v_dom,
                            'kayit_adi', v_dom, 'kayit_turu', 'TXT',
                            'kayit_degeri', v_tok);
end;
$fn$;

revoke all on function public.verification_start_domain(text, uuid) from public, anon;
grant execute on function public.verification_start_domain(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Sonucu yaz — YALNIZCA sunucu (Edge Function, service_role)
-- ---------------------------------------------------------------------------
-- İstemci asla "doğrulandı" yazamaz. DNS sorgusunu Postgres yapamadığı için
-- kontrol Edge Function'da; sonucu buraya yazar.
create or replace function public.verification_mark(
  p_id    uuid,
  p_ok    boolean,
  p_kanit jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_var public.identity_verifications; v_sahip uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;

  select * into v_var from public.identity_verifications where id = p_id;
  if v_var.id is null or v_var.iptal_at is not null then
    return jsonb_build_object('ok', false, 'hata', 'kayit_yok');
  end if;

  -- Sonsuz deneme, DNS sunucularına yük ve sessiz kaba kuvvet demek.
  if v_var.deneme_sayisi >= 50 then
    return jsonb_build_object('ok', false, 'hata', 'deneme_siniri');
  end if;

  update public.identity_verifications
     set durum            = case when p_ok then 'dogrulandi' else 'basarisiz' end,
         dogrulandi_at    = case when p_ok then now() else dogrulandi_at end,
         gecerlilik_bitis = case when p_ok then now() + interval '180 days'
                                 else gecerlilik_bitis end,
         kanit            = coalesce(p_kanit, '{}'::jsonb),
         deneme_sayisi    = deneme_sayisi + 1,
         son_deneme_at    = now(),
         updated_at       = now()
   where id = p_id;

  select user_id into v_sahip from public.profiles where id = v_var.profile_id;

  perform public.log_event(
    case when p_ok then 'verification.succeeded' else 'verification.failed' end,
    null, 'qrtim', 'identity_verification', p_id::text,
    case when p_ok then 'success' else 'failure' end,
    case when p_ok then 'notice' else 'warning' end, 'user',
    jsonb_build_object('tur', v_var.tur, 'konu', v_var.konu),
    'service', null, null, null, v_sahip);

  return jsonb_build_object('ok', true, 'durum',
                            case when p_ok then 'dogrulandi' else 'basarisiz' end);
end;
$fn$;

revoke all on function public.verification_mark(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.verification_mark(uuid, boolean, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 5) Kendi doğrulamalarım (panel)
-- ---------------------------------------------------------------------------
create or replace function public.my_verifications()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v_prof uuid := public.my_profile_id(); v_liste jsonb; v_eposta jsonb;
begin
  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'tur', v.tur, 'konu', v.konu, 'durum', v.durum,
           'yontem', v.yontem, 'kayit_degeri', v.meydan_okuma,
           'dogrulandi_at', v.dogrulandi_at,
           'gecerlilik_bitis', v.gecerlilik_bitis,
           'suresi_gecti', v.gecerlilik_bitis is not null and v.gecerlilik_bitis <= now(),
           'son_deneme_at', v.son_deneme_at,
           'kurum_id', v.organization_id,
           'kurum_adi', o.name,
           'created_at', v.created_at)
           order by v.created_at desc), '[]'::jsonb)
    into v_liste
    from public.identity_verifications v
    left join public.organizations o on o.id = v.organization_id
   where v.iptal_at is null
     and (v.profile_id = v_prof
          or (v.organization_id is not null and public.is_admin_of_org(v.organization_id)));

  -- E-posta rozet değil ama kaydın parçası: kişi hesabının durumunu görsün.
  select jsonb_build_object('dogrulandi', u.email_confirmed_at is not null,
                            'tarih', u.email_confirmed_at)
    into v_eposta
    from public.profiles p join auth.users u on u.id = p.user_id
   where p.id = v_prof;

  return jsonb_build_object('ok', true, 'liste', v_liste, 'eposta', v_eposta);
end;
$fn$;

revoke all on function public.my_verifications() from public, anon;
grant execute on function public.my_verifications() to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Doğrulamayı kaldır
-- ---------------------------------------------------------------------------
create or replace function public.verification_cancel(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_prof uuid := public.my_profile_id(); v_var public.identity_verifications;
begin
  select * into v_var from public.identity_verifications where id = p_id;
  if v_var.id is null or v_var.iptal_at is not null then
    return jsonb_build_object('ok', false, 'hata', 'kayit_yok');
  end if;
  if not (v_var.profile_id = v_prof
          or (v_var.organization_id is not null and public.is_admin_of_org(v_var.organization_id))) then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;

  update public.identity_verifications
     set iptal_at = now(), iptal_nedeni = 'sahibi kaldirdi',
         durum = 'iptal', updated_at = now()
   where id = p_id;

  perform public.log_event('verification.cancelled', auth.uid(), 'qrtim',
                           'identity_verification', p_id::text,
                           'success', 'notice', 'user',
                           jsonb_build_object('tur', v_var.tur, 'konu', v_var.konu),
                           'user', null, public.request_client_ip(), null, auth.uid());

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.verification_cancel(uuid) from public, anon;
grant execute on function public.verification_cancel(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Karta düşen doğrulamalar
-- ---------------------------------------------------------------------------
-- Saklanan doğrulamalar + TÜRETİLEN kurum üyeliği tek listede.
create or replace function public.card_verifications(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(jsonb_agg(x.kayit order by x.sira, x.dogrulandi_at desc), '[]'::jsonb)
  from (
    -- Kayıtlı doğrulamalar (şimdilik alan adı). Süresi geçen görünmez.
    select 1 as sira,
           v.dogrulandi_at,
           jsonb_build_object(
             'tur', v.tur,
             'konu', v.konu,
             'dogrulandi_at', v.dogrulandi_at,
             'yontem', v.yontem) as kayit
      from public.identity_verifications v
     where v.profile_id = p_profile_id
       and v.durum = 'dogrulandi'
       and v.iptal_at is null
       and (v.gecerlilik_bitis is null or v.gecerlilik_bitis > now())

    union all

    -- Kurum üyeliği: SAKLANMAZ, üyelikten türetilir. Kişi ayrılırsa rozet de
    -- aynı anda gider. Yalnızca KABUL EDİLMİŞ üyelik sayılır.
    select 2 as sira,
           m.accepted_at,
           jsonb_build_object(
             'tur', 'kurum',
             'konu', o.name,
             'dogrulandi_at', m.accepted_at,
             'yontem', 'kurum_onayi',
             'rol', m.role,
             -- Kurumun kendi alan adı doğrulanmışsa rozet daha ağır basar.
             'kurum_alan_adi', (
               select v2.konu from public.identity_verifications v2
                where v2.organization_id = o.id and v2.tur = 'alan_adi'
                  and v2.durum = 'dogrulandi' and v2.iptal_at is null
                  and (v2.gecerlilik_bitis is null or v2.gecerlilik_bitis > now())
                limit 1)) as kayit
      from public.members m
      join public.organizations o on o.id = m.organization_id
     where m.profile_id = p_profile_id
       and m.accepted_at is not null
  ) x;
$fn$;

revoke all on function public.card_verifications(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8) Kart yapısı: doğrulamalar eklendi + kabul edilmemiş davet düzeltmesi
-- ---------------------------------------------------------------------------
create or replace function public.build_public_card(p_profile_id uuid, p_persona_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_p public.profiles; v_x public.personas; v_row jsonb;
  v_fields jsonb := '{}'::jsonb; v_verified jsonb; v_links jsonb;
  v_orgs jsonb := '[]'::jsonb; v_payment jsonb; v_plan text; v_val jsonb; r record;
begin
  select * into v_p from public.profiles where id = p_profile_id;
  select * into v_x from public.personas where id = p_persona_id and profile_id = p_profile_id;
  if v_p.id is null or v_x.id is null then
    return null;
  end if;

  if v_x.status = 'paused' then
    return jsonb_build_object('paused', true);
  end if;

  v_row := to_jsonb(v_p);

  for r in
    select c.key, c.value_type, c.base_column, f.field_value
      from public.profile_field_catalog c
      join public.profile_fields f on f.field_key = c.key and f.persona_id = v_x.id
     where c.is_active and f.visibility = 'public'
     order by c.sort_order
  loop
    v_val := case
               when r.field_value is not null and jsonb_typeof(r.field_value) <> 'null' then r.field_value
               when r.base_column is not null then v_row -> r.base_column
             end;
    continue when v_val is null or jsonb_typeof(v_val) = 'null';
    if r.value_type = 'list' then
      continue when jsonb_typeof(v_val) <> 'array' or jsonb_array_length(v_val) = 0;
    else
      continue when jsonb_typeof(v_val) <> 'string' or btrim(v_val #>> '{}') = '';
    end if;
    v_fields := v_fields || jsonb_build_object(r.key, v_val);
  end loop;

  select coalesce(jsonb_agg(f.field_key), '[]'::jsonb) into v_verified
    from public.profile_fields f
   where f.persona_id = v_x.id and f.visibility = 'public' and f.verified_at is not null;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'platform', s.platform, 'url', s.url)
                            order by s.display_order), '[]'::jsonb)
    into v_links
    from public.persona_social_links l
    join public.social_links s on s.id = l.social_link_id
   where l.persona_id = v_x.id and s.url ~* '^https?://';

  if v_x.show_organizations then
    v_plan := coalesce(v_p.subscription_plan, 'free');
    select coalesce(jsonb_agg(t.o), '[]'::jsonb) into v_orgs
      from (
        select jsonb_build_object('id', og.id, 'name', og.name, 'type', og.type,
                                  'description', og.description, 'logo_url', og.logo_url,
                                  'phone', og.phone, 'email', og.email, 'website', og.website,
                                  'address', og.address, 'city', og.city, 'role', m.role) as o
          from public.members m
          join public.organizations og on og.id = m.organization_id
         where m.profile_id = v_p.id
           -- DÜZELTME: kabul edilmemiş davet üyelik değildir. Bu satır
           -- olmadan, bir kurum yöneticisi e-posta yazarak o kişinin herkese
           -- açık kartında kendi kurumunu gösterebiliyordu.
           and m.accepted_at is not null
         order by og.name
         limit case when v_plan in ('professional','stk','business','student','corporate') then 999 else 2 end
      ) t;
  end if;

  if v_x.show_payment then
    select jsonb_build_object(
             'bank_accounts', case when coalesce(pp.show_bank_accounts, false) then pp.bank_accounts end,
             'billing_info',  case when coalesce(pp.show_billing_info, false)  then pp.billing_info  end)
      into v_payment
      from public.profile_payment pp where pp.profile_id = v_p.id;
  end if;

  return jsonb_build_object(
    'id',                   v_p.id,
    'username',             v_p.username,
    'name',                 coalesce(v_x.display_name, v_p.name),
    'avatar_url',           coalesce(v_x.avatar_url, v_p.avatar_url),
    'avatar_3d_url',        v_p.avatar_3d_url,
    'background_image_url', v_p.background_image_url,
    'theme_color',          coalesce(v_x.theme_color, v_p.theme_color),
    'theme_style',          v_p.theme_style,
    'referral_code',        v_p.referral_code,
    'fields',               v_fields,
    'verified_fields',      v_verified,
    'dogrulamalar',         public.card_verifications(v_p.id),
    'social_links',         v_links,
    'organizations',        v_orgs,
    'payment',              v_payment,
    'share_path',           case when v_x.is_primary then '/card/' || v_p.username
                                 else '/k/' || v_x.share_code end
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 9) DÜZELTME (aynı gün, testte yakalandı): kurum rozeti kendi kendini onaylıyordu
-- ---------------------------------------------------------------------------
-- İlk hali "kabul edilmiş üyelik" yetiyordu sanıyordu. Ama kurum kaydını
-- HERKES açabiliyor ve açan kişi otomatik yönetici oluyor: biri "Sağlık
-- Bakanlığı" adıyla kurum açıp kendini üye yapar, kartında doğrulanmış kurum
-- rozeti taşırdı. Test bunu ilk denemede gösterdi (kendi üç kurumum da rozet
-- aldı — üçünü de ben kurmuşum).
--
-- Kural: kurum rozeti ancak KURUMUN ALAN ADI doğrulanmışsa çıkar. Böylece
-- rozetin arkasında o kurumun DNS'ine yazabilen biri olmak zorunda.
-- Kurum bağlılığı kartta görünmeye devam ediyor; yalnızca "doğrulanmış" diye
-- işaretlenmiyor.
create or replace function public.card_verifications(p_profile_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select coalesce(jsonb_agg(x.kayit order by x.sira, x.dogrulandi_at desc), '[]'::jsonb)
  from (
    select 1 as sira, v.dogrulandi_at,
           jsonb_build_object('tur', v.tur, 'konu', v.konu,
                              'dogrulandi_at', v.dogrulandi_at, 'yontem', v.yontem) as kayit
      from public.identity_verifications v
     where v.profile_id = p_profile_id
       and v.durum = 'dogrulandi' and v.iptal_at is null
       and (v.gecerlilik_bitis is null or v.gecerlilik_bitis > now())
    union all
    select 2 as sira, m.accepted_at,
           jsonb_build_object('tur', 'kurum', 'konu', o.name,
                              'dogrulandi_at', m.accepted_at, 'yontem', 'kurum_alan_adi',
                              'rol', m.role, 'kurum_alan_adi', d.konu) as kayit
      from public.members m
      join public.organizations o on o.id = m.organization_id
      join lateral (
        select v2.konu from public.identity_verifications v2
         where v2.organization_id = o.id and v2.tur = 'alan_adi'
           and v2.durum = 'dogrulandi' and v2.iptal_at is null
           and (v2.gecerlilik_bitis is null or v2.gecerlilik_bitis > now())
         limit 1
      ) d on true
     where m.profile_id = p_profile_id and m.accepted_at is not null
  ) x;
$fn$;

revoke all on function public.card_verifications(uuid) from public, anon, authenticated;

comment on function public.card_verifications(uuid) is
  'Kartta gosterilecek dogrulamalar. Kurum rozeti kurumun alan adi dogrulanmissa cikar; kurum kaydini herkes acabildigi icin uyelik tek basina kanit degildir.';
