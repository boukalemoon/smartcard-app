-- ============================================================================
-- KURTARMA SİSTEMİ
-- ============================================================================
--
-- ÜRÜN KARARI (kullanıcı, 13.09.2026): saf sıfır-bilgi REDDEDİLDİ.
--   "Kullanıcılara verilerini kurtarma imkânı vermezsek bu büyük bir risk
--    olur, itibarı ciddi zedeler."
-- Görev: en güvenli KURTARILABİLİR sistemi kurmak.
--
-- ÇEKİRDEK İLKE:
--   Kanalı KULLANICI seçer, bekleme süresini SİSTEM seçer.
--   Kanal seçimi güvenlik sınırı olsaydı, e-postayı ele geçiren veriyi de ele
--   geçirirdi. Bekleme süresi asıl savunmadır: saldırgan beklerken gerçek
--   kullanıcı bildirim alır ve TEK TIKLA iptal eder.
--
-- İPTAL, ONAYDAN KOLAY OLMALI:
--   İptal bağlantısı giriş gerektirmez (kullanıcı parolasını unutmuş olabilir),
--   tek seferlik belirteçle çalışır ve hesabı kilitleme seçeneği sunar.
--
-- VERİ ASLA SİLİNMEZ:
--   İptal edilen, reddedilen, süresi dolan hiçbir talep veriyi silmez.
--   Tek soru ne kadar hızlı geri verdiğimizdir.
--
-- BU MIGRATION NE YAPMIYOR:
--   Anahtar çözmüyor. Bugün şifrelenmiş veri yok (user_sync_data.is_encrypted
--   hep false). Şifreleme geldiğinde emanet anahtarın serbest bırakılması
--   `recovery_complete` içindeki işaretli noktaya bağlanacak — ve o anahtar
--   AYRI bir serviste duracak, bu veritabanında değil.

-- ---------------------------------------------------------------------------
-- 1) KURTARMA KİŞİSİ
-- ---------------------------------------------------------------------------
-- Kullanıcının onayladığı fikir: güvendiğin biri kurtarmanı onaylayabilir.
-- ŞART: kurtarma kişisi QRtım kullanıcısı olmak zorunda (yabancı bir e-posta
-- adresi değil). Bir kimliğin başka bir kimlik tarafından teyit edilmesi.

create table if not exists public.recovery_contacts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  contact_user_id uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'pending',
  invited_at      timestamptz not null default now(),
  responded_at    timestamptz,
  revoked_at      timestamptz,
  constraint recovery_contacts_kendisi_olamaz check (user_id <> contact_user_id),
  constraint recovery_contacts_status_chk
    check (status in ('pending','active','declined','revoked')),
  unique (user_id, contact_user_id)
);

comment on table public.recovery_contacts is
  'Kurtarma kişisi. QRtım kullanıcısı olmak zorunda — auth.users FK bunu garanti eder.';

create index if not exists recovery_contacts_contact_idx
  on public.recovery_contacts (contact_user_id) where status in ('pending','active');

alter table public.recovery_contacts enable row level security;

drop policy if exists "kurtarma kisisi gorunur" on public.recovery_contacts;
create policy "kurtarma kisisi gorunur"
  on public.recovery_contacts for select to authenticated
  using (user_id = (select auth.uid()) or contact_user_id = (select auth.uid()));
-- Yazma yalnızca RPC üzerinden: davet ve onay denetim kaydı gerektiren olaylar.

-- ---------------------------------------------------------------------------
-- 2) KURTARMA KODU
-- ---------------------------------------------------------------------------
-- Kullanıcıya BİR KEZ gösterilir. Yalnızca özeti saklanır; kod kaybolursa
-- yeniden üretilir, geri okunamaz.

create table if not exists public.recovery_codes (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  shown_at    timestamptz
);

alter table public.recovery_codes enable row level security;
-- Politika YOK: kullanıcı bile özeti okuyamamalı. Yalnızca RPC doğrular.

-- ---------------------------------------------------------------------------
-- 3) BİLİNEN CİHAZLAR
-- ---------------------------------------------------------------------------
-- Tanıdık cihazdan gelen talep daha az bekler; hiç görülmemiş cihaz/ülke
-- süreyi ikiye katlar.

create table if not exists public.trusted_devices (
  user_id     uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  label       text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (user_id, device_hash)
);

alter table public.trusted_devices enable row level security;

drop policy if exists "kendi cihazlarini gorur" on public.trusted_devices;
create policy "kendi cihazlarini gorur"
  on public.trusted_devices for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4) KURTARMA TALEBİ — DURUM MAKİNESİ
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  method        text not null,
  status        text not null default 'beklemede',
  opened_at     timestamptz not null default now(),
  verified_at   timestamptz,
  unlock_at     timestamptz,
  completed_at  timestamptz,
  closed_at     timestamptz,
  closed_reason text,
  -- İptal bağlantısı GİRİŞ GEREKTİRMEZ: kullanıcı parolasını unutmuş olabilir.
  cancel_token  text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  device_hash   text,
  ip            inet,
  user_agent    text,
  country       text,
  data_classes  text[] not null default '{}',
  constraint recovery_requests_method_chk check (method in
    ('cihaz_onayi','kurtarma_kodu','kurtarma_kisisi','eposta_otp','eposta_otp_parolasiz')),
  constraint recovery_requests_status_chk check (status in
    ('beklemede','dogrulandi','bekleme_suresinde','tamamlandi','iptal','suresi_doldu','reddedildi'))
);

comment on column public.recovery_requests.cancel_token is
  'Tek tıkla iptal. Giriş gerektirmez — parolasını unutan kullanıcı da iptal edebilmeli.';

create index if not exists recovery_requests_user_idx
  on public.recovery_requests (user_id, opened_at desc);
create index if not exists recovery_requests_acik_idx
  on public.recovery_requests (unlock_at)
  where status in ('beklemede','dogrulandi','bekleme_suresinde');

alter table public.recovery_requests enable row level security;

drop policy if exists "kendi kurtarma taleplerini gorur" on public.recovery_requests;
create policy "kendi kurtarma taleplerini gorur"
  on public.recovery_requests for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5) DOĞRULAMA KODLARI
-- ---------------------------------------------------------------------------
-- Kodun kendisi SAKLANMAZ, yalnızca özeti. Deneme sayısı sınırlı.

create table if not exists public.recovery_challenges (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.recovery_requests(id) on delete cascade,
  kind         text not null default 'eposta_otp',
  code_hash    text not null,
  expires_at   timestamptz not null default now() + interval '15 minutes',
  attempts     int not null default 0,
  max_attempts int not null default 5,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists recovery_challenges_req_idx
  on public.recovery_challenges (request_id, created_at desc);

alter table public.recovery_challenges enable row level security;
-- Politika YOK: kod özeti hiçbir istemciye gösterilmez.

-- ---------------------------------------------------------------------------
-- 6) BİLDİRİM KUYRUĞU
-- ---------------------------------------------------------------------------
-- Bildirim kaybolmamalı. E-posta gönderimi ayrı bir işçi tarafından bu
-- kuyruktan çekilir; SMTP hazır olmasa bile kayıt burada bekler.
-- Genel amaçlıdır, yalnız kurtarmaya ait değildir.

create table if not exists public.notification_outbox (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  channel      text not null default 'email',
  template     text not null,
  payload      jsonb not null default '{}',
  send_after   timestamptz not null default now(),
  sent_at      timestamptz,
  failed_at    timestamptz,
  attempts     int not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  constraint notification_outbox_channel_chk check (channel in ('email','sms','push','inapp'))
);

create index if not exists notification_outbox_bekleyen_idx
  on public.notification_outbox (send_after)
  where sent_at is null and failed_at is null;

alter table public.notification_outbox enable row level security;
-- Politika YOK: yalnızca gönderim işçisi (service_role) okur.

-- ---------------------------------------------------------------------------
-- 7) BEKLEME SÜRESİ TABLOSU
-- ---------------------------------------------------------------------------
-- Kanal kolaylığı belirler, bu fonksiyon güvenliği belirler.

create or replace function public.recovery_wait_interval(
  p_method       text,
  p_known_device boolean default false
) returns interval
language sql
immutable
set search_path = ''
as $fn$
  select case p_method
           when 'cihaz_onayi'          then interval '0'
           when 'kurtarma_kodu'        then interval '0'
           when 'kurtarma_kisisi'      then interval '12 hours'
           when 'eposta_otp'           then interval '24 hours'
           when 'eposta_otp_parolasiz' then interval '72 hours'
           else interval '72 hours'
         end
       * case when p_known_device then 1 else 2 end;
$fn$;

-- ---------------------------------------------------------------------------
-- 8) TALEP AÇ
-- ---------------------------------------------------------------------------

create or replace function public.recovery_start(
  p_method      text,
  p_email       text default null,
  p_device_hash text default null,
  p_ip          text default null,
  p_user_agent  text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user    uuid := auth.uid();
  v_known   boolean := false;
  v_wait    interval;
  v_req     uuid;
  v_token   text;
  v_acik    int;
begin
  -- Parolasını unutmuş kullanıcının oturumu yoktur; e-posta ile bulunur.
  if v_user is null and p_email is not null then
    select u.id into v_user from auth.users u
     where lower(u.email) = lower(btrim(p_email)) limit 1;
  end if;

  -- Var olmayan e-posta için de AYNI cevabı döndürüyoruz: aksi halde bu
  -- uç nokta "bu adres kayıtlı mı" sorusunu cevaplayan bir araca dönüşür.
  if v_user is null then
    return jsonb_build_object('ok', true, 'bilgi', 'talep_alindi');
  end if;

  if p_method not in ('cihaz_onayi','kurtarma_kodu','kurtarma_kisisi',
                      'eposta_otp','eposta_otp_parolasiz') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_yontem');
  end if;

  -- Aynı anda tek açık talep: aksi halde bildirim yağmuru olur.
  select count(*) into v_acik from public.recovery_requests r
   where r.user_id = v_user
     and r.status in ('beklemede','dogrulandi','bekleme_suresinde');
  if v_acik > 0 then
    return jsonb_build_object('ok', false, 'hata', 'zaten_acik_talep_var');
  end if;

  if p_device_hash is not null then
    select true into v_known from public.trusted_devices d
     where d.user_id = v_user and d.device_hash = p_device_hash;
  end if;

  v_wait := public.recovery_wait_interval(p_method, coalesce(v_known, false));

  insert into public.recovery_requests
    (user_id, method, device_hash, ip, user_agent, unlock_at)
  values
    (v_user, p_method, p_device_hash, nullif(p_ip,'')::inet, nullif(p_user_agent,''),
     now() + v_wait)
  returning id, cancel_token into v_req, v_token;

  -- Bildirim TÜM kanallara: talebi başlatan kişi kullanıcı olmayabilir.
  insert into public.notification_outbox (user_id, channel, template, payload)
  values (v_user, 'email', 'kurtarma_talebi_acildi',
          jsonb_build_object('request_id', v_req, 'cancel_token', v_token,
                             'method', p_method, 'unlock_at', now() + v_wait,
                             'ip', p_ip, 'user_agent', p_user_agent)),
         (v_user, 'inapp', 'kurtarma_talebi_acildi',
          jsonb_build_object('request_id', v_req, 'method', p_method));

  perform public.log_event('recovery.opened', v_user, 'qrtim',
                           'recovery_request', v_req::text,
                           'success', 'critical', 'user',
                           jsonb_build_object('yontem', p_method,
                                              'bilinen_cihaz', coalesce(v_known,false),
                                              'bekleme', v_wait::text),
                           null, null, p_ip, p_user_agent, v_user);

  return jsonb_build_object('ok', true, 'talep_id', v_req,
                            'bekleme_saniye', extract(epoch from v_wait)::bigint,
                            'acilabilir', now() + v_wait);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 9) TEK TIKLA İPTAL — GİRİŞ GEREKTİRMEZ
-- ---------------------------------------------------------------------------
-- Tasarımın en önemli parçalarından biri. İptal onaylamaktan kolay olmalı.

create or replace function public.recovery_cancel(
  p_token     text,
  p_lock_account boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_req public.recovery_requests;
begin
  select * into v_req from public.recovery_requests r
   where r.cancel_token = p_token
     and r.status in ('beklemede','dogrulandi','bekleme_suresinde');

  if v_req.id is null then
    -- Geçersiz belirteç de aynı cevabı alır (belirteç tarama engeli).
    return jsonb_build_object('ok', true);
  end if;

  update public.recovery_requests
     set status = 'iptal', closed_at = now(),
         closed_reason = case when p_lock_account then 'kullanici_iptal_kilitli'
                              else 'kullanici_iptal' end
   where id = v_req.id;

  insert into public.notification_outbox (user_id, channel, template, payload)
  values (v_req.user_id, 'email', 'kurtarma_talebi_iptal',
          jsonb_build_object('request_id', v_req.id, 'kilitlendi', p_lock_account));

  perform public.log_event('recovery.cancelled', null, 'qrtim',
                           'recovery_request', v_req.id::text,
                           'success', 'critical', 'user',
                           jsonb_build_object('hesap_kilitleme_istendi', p_lock_account),
                           'system', null, null, null, v_req.user_id);

  return jsonb_build_object('ok', true, 'iptal_edildi', true);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 10) KURTARMA KİŞİSİ ONAYI
-- ---------------------------------------------------------------------------

create or replace function public.recovery_approve_as_contact(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_req public.recovery_requests; v_ok boolean;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  select * into v_req from public.recovery_requests r
   where r.id = p_request_id
     and r.status in ('beklemede','dogrulandi','bekleme_suresinde');
  if v_req.id is null then
    return jsonb_build_object('ok', false, 'hata', 'talep_bulunamadi');
  end if;

  select true into v_ok from public.recovery_contacts c
   where c.user_id = v_req.user_id and c.contact_user_id = v_me and c.status = 'active';

  if not coalesce(v_ok, false) then
    perform public.log_event('recovery.contact_approve', v_me, 'qrtim',
                             'recovery_request', p_request_id::text,
                             'denied', 'critical', 'internal',
                             jsonb_build_object('sebep','kurtarma_kisisi_degil'),
                             null, null, null, null, v_req.user_id);
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  -- Onay süreyi kısaltır ama SIFIRLAMAZ: kurtarma kişisinin hesabı da
  -- ele geçirilmiş olabilir; 12 saat gerçek kullanıcıya itiraz payı bırakır.
  update public.recovery_requests
     set status = 'bekleme_suresinde',
         verified_at = coalesce(verified_at, now()),
         unlock_at = least(unlock_at, now() + interval '12 hours')
   where id = p_request_id;

  insert into public.notification_outbox (user_id, channel, template, payload)
  values (v_req.user_id, 'email', 'kurtarma_kisisi_onayladi',
          jsonb_build_object('request_id', p_request_id,
                             'cancel_token', v_req.cancel_token));

  perform public.log_event('recovery.contact_approve', v_me, 'qrtim',
                           'recovery_request', p_request_id::text,
                           'success', 'critical', 'user', '{}'::jsonb,
                           null, null, null, null, v_req.user_id);

  return jsonb_build_object('ok', true);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 11) AÇIK OTURUMDAN ONAY — en güvenli ve en kolay yol
-- ---------------------------------------------------------------------------

create or replace function public.recovery_approve_from_session(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_req public.recovery_requests;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  select * into v_req from public.recovery_requests r
   where r.id = p_request_id and r.user_id = v_me
     and r.status in ('beklemede','dogrulandi','bekleme_suresinde');
  if v_req.id is null then
    return jsonb_build_object('ok', false, 'hata', 'talep_bulunamadi');
  end if;

  -- Kendi açık oturumundan onay: bekleme yok. Zaten hesaba erişimi var.
  update public.recovery_requests
     set status = 'dogrulandi', verified_at = now(), unlock_at = now()
   where id = p_request_id;

  perform public.log_event('recovery.session_approve', v_me, 'qrtim',
                           'recovery_request', p_request_id::text,
                           'success', 'critical', 'user', '{}'::jsonb,
                           null, null, null, null, v_me);

  return jsonb_build_object('ok', true, 'hemen_acilabilir', true);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 12) TAMAMLA
-- ---------------------------------------------------------------------------

create or replace function public.recovery_complete(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_req public.recovery_requests;
begin
  select * into v_req from public.recovery_requests r
   where r.id = p_request_id and r.user_id = v_me;
  if v_req.id is null then
    return jsonb_build_object('ok', false, 'hata', 'talep_bulunamadi');
  end if;
  if v_req.status in ('iptal','reddedildi','suresi_doldu') then
    return jsonb_build_object('ok', false, 'hata', 'talep_kapali', 'durum', v_req.status);
  end if;
  if v_req.unlock_at > now() then
    return jsonb_build_object('ok', false, 'hata', 'bekleme_suresi_dolmadi',
                              'acilabilir', v_req.unlock_at);
  end if;

  -- >>> ŞİFRELEME GELDİĞİNDE: emanet anahtarın serbest bırakılması BURAYA
  -- >>> bağlanacak. Anahtar AYRI bir serviste duracak, bu veritabanında
  -- >>> değil — aksi halde tek bir ihlal hem veriyi hem anahtarı verir.
  -- >>> Bugün şifrelenmiş veri yok; talep yalnızca onaylanmış işaretlenir.

  update public.recovery_requests
     set status = 'tamamlandi', completed_at = now(), closed_at = now(),
         closed_reason = 'tamamlandi'
   where id = p_request_id;

  insert into public.notification_outbox (user_id, channel, template, payload)
  values (v_req.user_id, 'email', 'kurtarma_tamamlandi',
          jsonb_build_object('request_id', p_request_id));

  perform public.log_event('recovery.completed', v_me, 'qrtim',
                           'recovery_request', p_request_id::text,
                           'success', 'critical', 'user',
                           jsonb_build_object('yontem', v_req.method),
                           null, null, null, null, v_req.user_id);

  return jsonb_build_object('ok', true);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 13) SÜRESİ DOLANLARI KAPAT
-- ---------------------------------------------------------------------------
-- pg_cron bu projede KURULU DEĞİL; dışarıdan (Vercel Cron / Edge Function)
-- çağrılmalı. Çağrılmasa bile veri kaybı olmaz, talepler açık kalır.

create or replace function public.recovery_expire_stale()
returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_n int;
begin
  update public.recovery_requests
     set status = 'suresi_doldu', closed_at = now(), closed_reason = 'zaman_asimi'
   where status in ('beklemede','dogrulandi','bekleme_suresinde')
     and opened_at < now() - interval '14 days';
  get diagnostics v_n = row_count;

  update public.recovery_challenges
     set consumed_at = now()
   where consumed_at is null and expires_at < now();

  return v_n;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 14) KURTARMA KİŞİSİ YÖNETİMİ
-- ---------------------------------------------------------------------------

create or replace function public.recovery_contact_invite(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_hedef uuid;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'hata', 'oturum_yok'); end if;

  select u.id into v_hedef from auth.users u
   where lower(u.email) = lower(btrim(p_email)) limit 1;

  -- ŞART: kurtarma kişisi QRtım kullanıcısı olmalı.
  if v_hedef is null then
    return jsonb_build_object('ok', false, 'hata', 'qrtim_kullanicisi_degil');
  end if;
  if v_hedef = v_me then
    return jsonb_build_object('ok', false, 'hata', 'kendini_secemezsin');
  end if;

  insert into public.recovery_contacts (user_id, contact_user_id)
  values (v_me, v_hedef)
  on conflict (user_id, contact_user_id) do update
    set status = 'pending', invited_at = now(), responded_at = null, revoked_at = null;

  insert into public.notification_outbox (user_id, channel, template, payload)
  values (v_hedef, 'email', 'kurtarma_kisisi_daveti',
          jsonb_build_object('davet_eden', v_me));

  perform public.log_event('recovery.contact_invited', v_me, 'qrtim',
                           'recovery_contact', v_hedef::text,
                           'success', 'notice', 'user', '{}'::jsonb);

  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.recovery_contact_respond(
  p_user_id uuid,
  p_accept  boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_n int;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'hata', 'oturum_yok'); end if;

  update public.recovery_contacts
     set status = case when p_accept then 'active' else 'declined' end,
         responded_at = now()
   where user_id = p_user_id and contact_user_id = v_me and status = 'pending';
  get diagnostics v_n = row_count;

  if v_n = 0 then return jsonb_build_object('ok', false, 'hata', 'davet_bulunamadi'); end if;

  perform public.log_event('recovery.contact_responded', v_me, 'qrtim',
                           'recovery_contact', p_user_id::text,
                           'success', 'notice', 'user',
                           jsonb_build_object('kabul', p_accept),
                           null, null, null, null, p_user_id);

  return jsonb_build_object('ok', true, 'kabul', p_accept);
end;
$fn$;

create or replace function public.recovery_contact_revoke(p_contact_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_n int;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'hata', 'oturum_yok'); end if;
  update public.recovery_contacts
     set status = 'revoked', revoked_at = now()
   where user_id = v_me and contact_user_id = p_contact_user_id and status <> 'revoked';
  get diagnostics v_n = row_count;

  perform public.log_event('recovery.contact_revoked', v_me, 'qrtim',
                           'recovery_contact', p_contact_user_id::text,
                           'success', 'warning', 'user', '{}'::jsonb);
  return jsonb_build_object('ok', v_n > 0);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 15) YETKİLER
-- ---------------------------------------------------------------------------
-- recovery_start ve recovery_cancel BİLEREK anon'a açık: kullanıcı parolasını
-- unutmuş olabilir, oturumu yoktur. İkisi de kimlik sızdırmaz — var olmayan
-- e-posta ve geçersiz belirteç aynı cevabı alır.

revoke all on function public.recovery_start(text,text,text,text,text)  from public;
revoke all on function public.recovery_cancel(text,boolean)             from public;
grant execute on function public.recovery_start(text,text,text,text,text) to anon, authenticated;
grant execute on function public.recovery_cancel(text,boolean)            to anon, authenticated;

revoke all on function public.recovery_approve_as_contact(uuid)    from public, anon;
revoke all on function public.recovery_approve_from_session(uuid)  from public, anon;
revoke all on function public.recovery_complete(uuid)              from public, anon;
revoke all on function public.recovery_contact_invite(text)        from public, anon;
revoke all on function public.recovery_contact_respond(uuid,boolean) from public, anon;
revoke all on function public.recovery_contact_revoke(uuid)        from public, anon;
grant execute on function public.recovery_approve_as_contact(uuid)     to authenticated;
grant execute on function public.recovery_approve_from_session(uuid)   to authenticated;
grant execute on function public.recovery_complete(uuid)               to authenticated;
grant execute on function public.recovery_contact_invite(text)         to authenticated;
grant execute on function public.recovery_contact_respond(uuid,boolean) to authenticated;
grant execute on function public.recovery_contact_revoke(uuid)         to authenticated;

revoke all on function public.recovery_expire_stale()                  from public, anon, authenticated;
grant execute on function public.recovery_expire_stale()               to service_role;
revoke all on function public.recovery_wait_interval(text,boolean)     from public, anon;
grant execute on function public.recovery_wait_interval(text,boolean)  to authenticated;
