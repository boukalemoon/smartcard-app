-- ============================================================================
-- Kurum koltukları — 1. ADIM: veri katmanı ve TEK plan çözümleyici
-- ============================================================================
--
-- HEDEF: Toplu alım yapan şirket, satın aldığı koltukları kendi üyelerine
-- dağıtsın. Kurum yöneticisi kime koltuk verdiğini seçer, geri alabilir.
--
-- BU ADIMDA ARAYÜZ YOK VE DAVRANIŞ DEĞİŞMEZ. Hiç koltuk verilmediği sürece
-- plan çözümlemesi bugünkü sonucu birebir üretir; arayüz 2. adımda gelir.
-- Yarım bir özelliği kullanıcıya göstermemek için böyle bölündü.
--
-- ---------------------------------------------------------------------------
-- NEDEN AYRI TABLO: koltuk, üyenin abonelik satırına YAZILAMAZ
-- ---------------------------------------------------------------------------
-- subscriptions'ta UNIQUE (profile_id) var: profil başına tek satır. Koltuğu
-- o satıra yazmak demek:
--   • expire_subscriptions (saatlik cron) ve payment_settle ile çakışmak,
--   • koltuğu geri alırken "eski hâli" geri yüklemek zorunda kalmak,
--   • kişi arada KENDİ planını satın aldıysa onun üzerine yazmak.
-- Bu yüzden koltuk ayrı kayıt; plan çözümlemesi kişisel abonelik ile koltuğun
-- İYİSİNİ seçiyor. Kişisel abonelik hiç değişmiyor, geri alma tek satır.
--
-- ---------------------------------------------------------------------------
-- NEDEN TEK ÇÖZÜMLEYİCİ
-- ---------------------------------------------------------------------------
-- Plan bugün İKİ yerde ayrı ayrı hesaplanıyor: my_plan_limits() (panel) ve
-- effective_plan_for_user() (partnerler). Gövdeleri aynı sorguyu tekrar
-- ediyor. arku-link'teki not tam bu riski yazmış: "aynı şeyi hesaplayan iki
-- kod yolu er geç ayrışır". Koltuk ikisine de girecekse ayrışma kesin olurdu.
-- İkisi artık gecerli_plan(profile_id)'i çağırıyor.

-- ---------------------------------------------------------------------------
-- 1) Plan sıralaması — VERİDEN türetildi, uydurulmadı
-- ---------------------------------------------------------------------------
-- plan_features'taki her sütun (persona_limit, sync_max_devices,
-- sync_passwords, organizations_limit, social_links_limit) bu sırada hiç
-- geriye gitmiyor; doğrusal sıralama bu yüzden güvenli. Sıra KODDA DEĞİL
-- TABLODA: yeni kademe eklenince burası güncellenir.
alter table public.plan_features
  add column if not exists rank smallint;

update public.plan_features set rank = case plan
  when 'free' then 0
  when 'student' then 1
  when 'professional' then 2
  when 'stk' then 3
  when 'business' then 4
  when 'corporate' then 5
  else 0 end
 where rank is null;

comment on column public.plan_features.rank is
  'Plan kademesi (buyuk = genis yetki). plan_features sutunlarindan turetildi. "Iyi olan plan" karsilastirmasi bunu kullanir.';

-- ---------------------------------------------------------------------------
-- 2) Kurumun satın aldığı koltuk kotası
-- ---------------------------------------------------------------------------
-- Toplu alım TEKLİFLE yürüyor (platformda adetli satın alma yok), bu yüzden
-- kotayı PLATFORM YÖNETİCİSİ giriyor: şirket teklifi kabul edip ödeyince
-- kota tanımlanır, dağıtımı şirket kendi yapar.
alter table public.organizations
  add column if not exists seat_quota int not null default 0,
  add column if not exists seat_plan text,
  add column if not exists seat_quota_expires_at timestamptz;

alter table public.organizations
  drop constraint if exists organizations_seat_quota_chk;
alter table public.organizations
  add constraint organizations_seat_quota_chk check (seat_quota >= 0);

alter table public.organizations
  drop constraint if exists organizations_seat_plan_chk;
alter table public.organizations
  add constraint organizations_seat_plan_chk
  check (seat_plan is null or seat_plan in ('student','professional','stk','business','corporate'));

comment on column public.organizations.seat_quota is
  'Kurumun satin aldigi koltuk adedi. Toplu alim teklifle yurudugu icin PLATFORM YONETICISI girer.';
comment on column public.organizations.seat_plan is
  'Koltugun verdigi plan kademesi. null ise kurum koltuk dagitamaz.';

-- ---------------------------------------------------------------------------
-- 3) Koltuk kayıtları
-- ---------------------------------------------------------------------------
create table if not exists public.org_seats (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  -- Koltuğun verdiği plan, VERİLDİĞİ ANDA sabitlenir. Kurumun kotası sonradan
  -- düşse bile verilmiş koltuk kendiliğinden değişmez; yönetici geri alır.
  plan            text not null,
  -- Koltuğun bitişi ZORUNLU: süresiz yetki kazası olmasın (admin_set_plan'da
  -- aynı hata yaşandı, orada da bitiş zorunlu kılındı).
  expires_at      timestamptz not null,
  granted_by      uuid references public.profiles(id) on delete set null,
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles(id) on delete set null,
  constraint org_seats_plan_chk
    check (plan in ('student','professional','stk','business','corporate'))
);

-- Bir üyeye aynı kurumdan AYNI ANDA tek açık koltuk.
create unique index if not exists org_seats_tek_acik_idx
  on public.org_seats (organization_id, profile_id)
  where revoked_at is null;

create index if not exists org_seats_profil_idx
  on public.org_seats (profile_id) where revoked_at is null;

alter table public.org_seats enable row level security;

-- Üye KENDİ koltuğunu görür (hangi kurum, hangi plan, ne zamana kadar).
drop policy if exists "kendi koltugunu gorur" on public.org_seats;
create policy "kendi koltugunu gorur"
  on public.org_seats for select to authenticated
  using (profile_id = public.my_profile_id());

-- Kurum yöneticisi kurumunun koltuklarını görür.
drop policy if exists "kurum yoneticisi koltuklari gorur" on public.org_seats;
create policy "kurum yoneticisi koltuklari gorur"
  on public.org_seats for select to authenticated
  using (exists (
    select 1 from public.members m
     where m.organization_id = org_seats.organization_id
       and m.profile_id = public.my_profile_id()
       and m.role in ('admin', 'owner')
       and m.accepted_at is not null
  ));

-- YAZMA POLİTİKASI YOK: koltuk verme/alma yalnız RPC ile (2. adım). İstemci
-- kendine koltuk yazamaz.
revoke all on public.org_seats from anon, authenticated;
grant select on public.org_seats to authenticated;

comment on table public.org_seats is
  'Kurumun uyesine verdigi abonelik koltugu. Kisisel abonelik satirina DOKUNULMAZ; plan cozumlemesi ikisinin iyisini secer. Yazma yalniz RPC ile.';

-- ---------------------------------------------------------------------------
-- 4) TEK plan çözümleyici
-- ---------------------------------------------------------------------------
-- Kişisel abonelik ile açık koltuğun İYİSİNİ döndürür. Koltuk yoksa sonuç
-- bugünkü davranışla birebir aynıdır.
--
-- Kimlik doğrulaması YAPMAZ: çağıranın p_profile_id'yi hak ettiğini
-- doğrulaması ÇAĞIRANIN işi (effective_plan_for_user'daki aynı not).
create or replace function public.gecerli_plan(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kisi_plan   text;
  v_kisi_bitis  timestamptz;
  v_koltuk_plan text;
  v_koltuk_bitis timestamptz;
  v_koltuk_org  uuid;
  v_plan        text;
  v_bitis       timestamptz;
  v_kaynak      text;
  v_pf          public.plan_features;
begin
  if p_profile_id is null then return null; end if;

  select s.plan, s.expires_at into v_kisi_plan, v_kisi_bitis
    from public.subscriptions s
   where s.profile_id = p_profile_id
     and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc
   limit 1;

  -- En iyi açık koltuk. Süresi geçmiş ya da geri alınmış koltuk sayılmaz.
  select os.plan, os.expires_at, os.organization_id
    into v_koltuk_plan, v_koltuk_bitis, v_koltuk_org
    from public.org_seats os
    join public.plan_features pf on pf.plan = os.plan
   where os.profile_id = p_profile_id
     and os.revoked_at is null
     and os.expires_at > now()
   order by pf.rank desc, os.expires_at desc
   limit 1;

  v_kisi_plan := coalesce(v_kisi_plan, 'free');

  -- İYİSİ KAZANIR, yenisi değil. Kişi kendi planını satın aldıysa daha düşük
  -- kademeli bir koltuk onu AŞAĞI ÇEKMEZ.
  if v_koltuk_plan is not null
     and coalesce((select rank from public.plan_features where plan = v_koltuk_plan), 0)
       > coalesce((select rank from public.plan_features where plan = v_kisi_plan), 0)
  then
    v_plan   := v_koltuk_plan;
    v_bitis  := v_koltuk_bitis;
    v_kaynak := 'koltuk';
  else
    v_plan   := v_kisi_plan;
    v_bitis  := v_kisi_bitis;
    v_kaynak := case when v_kisi_plan = 'free' then 'ucretsiz' else 'abonelik' end;
  end if;

  select * into v_pf from public.plan_features where plan = v_plan;

  return jsonb_build_object(
    'plan', v_plan,
    -- Tanımsız plan adı ücretsiz sayılır: güvenli taraf.
    'ucretli', coalesce(v_pf.ucretli, false),
    'expires_at', v_bitis,
    'max_sync_devices', coalesce(v_pf.sync_max_devices, 1),
    'password_sync', coalesce(v_pf.sync_passwords, false),
    -- Planın NEREDEN geldiği: panel "kurumunuz sağlıyor" diyebilsin.
    'kaynak', v_kaynak,
    'koltuk_kurum_id', case when v_kaynak = 'koltuk' then v_koltuk_org else null end);
end;
$$;

revoke all on function public.gecerli_plan(uuid) from public, anon, authenticated;

comment on function public.gecerli_plan(uuid) is
  'TEK plan cozumleyici: kisisel abonelik ile acik kurum koltugunun IYISI. my_plan_limits ve effective_plan_for_user bunu cagirir; ikinci bir hesap yolu acilmaz.';

-- ---------------------------------------------------------------------------
-- 5) İki mevcut çözümleyici artık gecerli_plan'ı çağırıyor
-- ---------------------------------------------------------------------------
-- Gövdelerindeki abonelik sorgusu KALDIRILDI; plan kararı tek yerden geliyor.
-- Dönüş biçimleri AYNEN korundu: çağıran arayüz ve partnerler değişmedi.
-- Koltuk yoksa sonuç bugünküyle birebir aynıdır.

create or replace function public.my_plan_limits()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prof uuid := public.my_profile_id();
  v_gp   jsonb;
  v_plan text;
  v_pf   public.plan_features;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  v_gp := public.gecerli_plan(v_prof);
  v_plan := coalesce(v_gp ->> 'plan', 'free');
  select * into v_pf from public.plan_features where plan = v_plan;

  return jsonb_build_object(
    'ok', true,
    'plan', v_plan,
    'expires_at', (v_gp ->> 'expires_at')::timestamptz,
    -- Planın nereden geldiği: panel "kurumunuz sağlıyor" diyebilsin.
    -- Yeni alanlar; eski alanların hiçbiri kaldırılmadı.
    'kaynak', v_gp ->> 'kaynak',
    'koltuk_kurum_id', v_gp ->> 'koltuk_kurum_id',
    'sinir', jsonb_build_object(
      'profil',        coalesce(v_pf.persona_limit, 2),
      'organizasyon',  coalesce(v_pf.organizations_limit, 2),
      'sosyal_medya',  coalesce(v_pf.social_links_limit, 3),
      'nfc_yillik',    coalesce(v_pf.nfc_cards_yearly, 0),
      'senkron_cihaz', coalesce(v_pf.sync_max_devices, 1),
      'sifre_senkronu', coalesce(v_pf.sync_passwords, false)),
    'kullanim', jsonb_build_object(
      'profil',       (select count(*) from public.personas where profile_id = v_prof),
      'organizasyon', (select count(*) from public.members m
                        where m.profile_id = v_prof and m.role = 'admin' and m.accepted_at is not null),
      'sosyal_medya', (select count(*) from public.social_links where profile_id = v_prof)));
end;
$$;

comment on function public.my_plan_limits() is
  'Kisinin plani, sinirlari ve kullanimi. Plan karari gecerli_plan() ten gelir (kisisel abonelik + kurum koltugunun iyisi).';

create or replace function public.effective_plan_for_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_prof uuid; v_gp jsonb;
begin
  -- Yalnızca sunucu. Bu fonksiyon kimlik doğrulaması YAPMAZ; çağıranın
  -- p_user_id'yi hak ettiğini doğrulaması ÇAĞIRANIN işidir.
  if coalesce(auth.role(), '') <> 'service_role' then
    return null;
  end if;
  if p_user_id is null then return null; end if;

  -- profiles.id ≠ user_id (34 profilin 7'sinde farklı) — doğru kolondan.
  select id into v_prof from public.profiles where user_id = p_user_id;
  if v_prof is null then return null; end if;

  v_gp := public.gecerli_plan(v_prof);
  if v_gp is null then return null; end if;

  -- Dönüş biçimi DEĞİŞMEDİ: partnerler aynı alanları okuyor. 'kaynak' ve
  -- 'koltuk_kurum_id' bilerek GÖNDERİLMİYOR — partnerin kişinin hangi kurumdan
  -- koltuk aldığını bilmesine gerek yok (en az bilgi).
  return jsonb_build_object(
    'plan', v_gp ->> 'plan',
    'ucretli', coalesce((v_gp ->> 'ucretli')::boolean, false),
    'expires_at', (v_gp ->> 'expires_at')::timestamptz,
    'max_sync_devices', coalesce((v_gp ->> 'max_sync_devices')::int, 1),
    'password_sync', coalesce((v_gp ->> 'password_sync')::boolean, false));
end;
$$;

comment on function public.effective_plan_for_user(uuid) is
  'Partnerler icin gecerli plan. Karar gecerli_plan() ten gelir; kurum koltugu bilgisi (kaynak/kurum) partnere GONDERILMEZ.';
