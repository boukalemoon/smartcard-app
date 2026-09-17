-- ============================================================================
-- ADIM 5b — UYGULAMADAN BAĞIMSIZ KULLANICI SENKRONİZASYONU
-- ============================================================================
--
-- ilgezdi_sync_data'nın yerini alır. Fark:
--   • Uygulamaya özel değil: (user_id, app_key, data_type) üçlüsü.
--     Beşinci uygulama için tek satır kayıt yeter, yeni tablo gerekmez.
--   • SÜRÜM NUMARASI var. Bugün İlgezdi iki cihazdan senkron olsa ikincisi
--     birincinin yer imlerini sessizce eziyordu; artık sürüm çakışması
--     hata olarak dönüyor.
--   • BOYUT SINIRI var (5 MB). Bugün sınır yok: tek kullanıcı jsonb'ye
--     istediği kadar veri yazabilir.
--   • Her yazma denetim kaydına düşüyor.
--
-- TERCİHLER ayrı tabloda, çünkü soru farklı: senkron verisi "bu uygulamanın
-- benim için sakladığı şey", tercih ise "ben nasıl davranılmasını istiyorum".
-- İkincisi uygulamalar arası paylaşılır — dijital kimliğin asıl parçası bu.

-- ---------------------------------------------------------------------------
-- 1) UYGULAMA BAĞLANTILARI
-- ---------------------------------------------------------------------------
-- "QRtım hesabımla hangi uygulamalara giriş yaptım, ne zaman, hâlâ açık mı?"
-- Bugün bu bilgi partner_user_links / partner_connections / identity_links
-- arasına dağılmış ve üçü de boş.

create table if not exists public.app_connections (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  app_key      text        not null references public.integration_providers(key) on delete cascade,
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz,
  scopes       text[]      not null default '{}',
  primary key (user_id, app_key)
);

create index if not exists app_connections_user_idx on public.app_connections (user_id)
  where revoked_at is null;

alter table public.app_connections enable row level security;

drop policy if exists "kendi baglantilarini gorur"   on public.app_connections;
drop policy if exists "kendi baglantisini guncelier" on public.app_connections;

create policy "kendi baglantilarini gorur"
  on public.app_connections for select to authenticated
  using (user_id = (select auth.uid()));

-- Yazma yalnızca RPC üzerinden (aşağıdaki app_connect/app_disconnect).
-- Doğrudan INSERT/UPDATE politikası bilerek yok: bağlantı kurmak denetim
-- kaydı gerektiren bir olay, istemcinin sessizce yapabileceği bir şey değil.

-- ---------------------------------------------------------------------------
-- 2) KULLANICI TERCİHLERİ
-- ---------------------------------------------------------------------------
-- scope = 'global'  -> tüm uygulamalar için geçerli (dil, tema, erişilebilirlik)
-- scope = <app_key> -> yalnızca o uygulamada geçerli, global'i ezer

create table if not exists public.user_preferences (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  scope      text        not null default 'global',
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (user_id, scope, key),
  constraint user_preferences_key_chk check (key ~ '^[a-zA-Z0-9_.-]{1,64}$')
);

alter table public.user_preferences enable row level security;

drop policy if exists "kendi tercihlerini okur"   on public.user_preferences;
drop policy if exists "kendi tercihlerini yazar"  on public.user_preferences;
drop policy if exists "kendi tercihlerini gunceller" on public.user_preferences;
drop policy if exists "kendi tercihlerini siler"  on public.user_preferences;

create policy "kendi tercihlerini okur"
  on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "kendi tercihlerini yazar"
  on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "kendi tercihlerini gunceller"
  on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "kendi tercihlerini siler"
  on public.user_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3) SENKRON VERİSİ
-- ---------------------------------------------------------------------------

create table if not exists public.user_sync_data (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  app_key      text        not null references public.integration_providers(key) on delete cascade,
  data_type    text        not null,
  payload      jsonb       not null default '{}',
  is_encrypted boolean     not null default false,
  enc_version  smallint,
  version      bigint      not null default 1,
  size_bytes   integer     not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, app_key, data_type),
  constraint user_sync_data_type_chk check (data_type ~ '^[a-z0-9_]{1,32}$')
);

comment on column public.user_sync_data.is_encrypted is
  'İleride uçtan uca şifreleme gelirse payload okunamaz blob olur. Bugün hep false.';

alter table public.user_sync_data enable row level security;

drop policy if exists "kendi senkron verisini okur" on public.user_sync_data;
create policy "kendi senkron verisini okur"
  on public.user_sync_data for select to authenticated
  using (user_id = (select auth.uid()));

-- Yazma yalnızca sync_push üzerinden: sürüm kontrolü, boyut sınırı ve
-- denetim kaydı atlanamasın diye doğrudan yazma politikası yok.

-- Boyut sınırı — RPC dışından (service_role, migration) gelen yazmalar için
-- son savunma hattı. RPC zaten dostane hata döndürüyor.
create or replace function public.user_sync_data_guard()
returns trigger
language plpgsql
as $fn$
begin
  new.size_bytes := pg_column_size(new.payload);
  if new.size_bytes > 5 * 1024 * 1024 then
    raise exception 'senkron verisi 5 MB sinirini asiyor (% bayt)', new.size_bytes
      using errcode = '22001';
  end if;
  -- Yalnızca güncellemede dokunuyoruz: eklemede çağıran gerçek tarihi
  -- verebilmeli (mevcut İlgezdi verisi 25.07.2026 tarihiyle taşınıyor).
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$fn$;

drop trigger if exists user_sync_data_guard_trg on public.user_sync_data;
create trigger user_sync_data_guard_trg
  before insert or update on public.user_sync_data
  for each row execute function public.user_sync_data_guard();

-- ---------------------------------------------------------------------------
-- 4) RPC: BAĞLANTI KUR / KES
-- ---------------------------------------------------------------------------

create or replace function public.app_connect(
  p_app_key text,
  p_scopes  text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;
  if not exists (select 1 from public.integration_providers ip
                  where ip.key = p_app_key and ip.is_active) then
    return jsonb_build_object('ok', false, 'hata', 'uygulama_tanimsiz');
  end if;

  insert into public.app_connections as c (user_id, app_key, scopes, last_seen_at)
  values (v_user, p_app_key, coalesce(p_scopes, '{}'), now())
  on conflict (user_id, app_key) do update
    set revoked_at   = null,
        scopes       = coalesce(excluded.scopes, c.scopes),
        last_seen_at = now();

  perform public.log_event('app.connect', v_user, p_app_key, 'app_connection', p_app_key,
                           'success', 'notice', 'user',
                           jsonb_build_object('scopes', coalesce(p_scopes, '{}')));

  return jsonb_build_object('ok', true);
end;
$fn$;

grant execute on function public.app_connect(text, text[]) to authenticated;

create or replace function public.app_disconnect(p_app_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_user uuid := auth.uid(); v_n int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  update public.app_connections
     set revoked_at = now()
   where user_id = v_user and app_key = p_app_key and revoked_at is null;
  get diagnostics v_n = row_count;

  -- Bağlantı kesilince o uygulamanın senkron verisi de gider. Kullanıcı
  -- "bağlantıyı kaldırdım" dediğinde verisinin kalmasını beklemez.
  delete from public.user_sync_data
   where user_id = v_user and app_key = p_app_key;

  perform public.log_event('app.disconnect', v_user, p_app_key, 'app_connection', p_app_key,
                           case when v_n > 0 then 'success' else 'failure' end,
                           'warning', 'user',
                           jsonb_build_object('baglanti_vardi', v_n > 0));

  return jsonb_build_object('ok', v_n > 0);
end;
$fn$;

grant execute on function public.app_disconnect(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) RPC: TERCİHLER
-- ---------------------------------------------------------------------------
-- get_preferences: global tercihlerin üstüne uygulamaya özel olanlar biner.
-- Uygulama tek çağrıda "bu kullanıcı benden ne bekliyor" cevabını alır.

create or replace function public.get_preferences(p_app_key text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $fn$
  with g as (
    select jsonb_object_agg(p.key, p.value) obj
      from public.user_preferences p
     where p.user_id = auth.uid() and p.scope = 'global'
  ), a as (
    select jsonb_object_agg(p.key, p.value) obj
      from public.user_preferences p
     where p.user_id = auth.uid()
       and p_app_key is not null
       and p.scope = p_app_key
  )
  select coalesce((select obj from g), '{}'::jsonb)
      || coalesce((select obj from a), '{}'::jsonb);
$fn$;

grant execute on function public.get_preferences(text) to authenticated;

-- set_preferences: tek çağrıda birden çok tercih. Uygulamalar tercih başına
-- ayrı istek atmasın diye toplu.

create or replace function public.set_preferences(
  p_prefs jsonb,
  p_scope text default 'global'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user  uuid := auth.uid();
  v_scope text := coalesce(nullif(btrim(p_scope), ''), 'global');
  v_n     int  := 0;
  v_key   text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_veri');
  end if;
  if v_scope <> 'global'
     and not exists (select 1 from public.integration_providers ip
                      where ip.key = v_scope and ip.is_active) then
    return jsonb_build_object('ok', false, 'hata', 'uygulama_tanimsiz');
  end if;
  if (select count(*) from jsonb_object_keys(p_prefs)) > 200 then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_tercih');
  end if;

  for v_key in select k from jsonb_object_keys(p_prefs) k loop
    if v_key !~ '^[a-zA-Z0-9_.-]{1,64}$' then
      return jsonb_build_object('ok', false, 'hata', 'gecersiz_anahtar', 'anahtar', v_key);
    end if;
  end loop;

  insert into public.user_preferences as up (user_id, scope, key, value, updated_by)
  select v_user, v_scope, e.key, e.value, v_scope
    from jsonb_each(p_prefs) e
  on conflict (user_id, scope, key) do update
    set value      = excluded.value,
        updated_at = now(),
        updated_by = excluded.updated_by;
  get diagnostics v_n = row_count;

  perform public.log_event('prefs.set', v_user,
                           case when v_scope = 'global' then null else v_scope end,
                           'user_preferences', v_scope, 'success', 'info', 'user',
                           jsonb_build_object('adet', v_n,
                                              'anahtarlar', (select jsonb_agg(k)
                                                               from jsonb_object_keys(p_prefs) k)));

  return jsonb_build_object('ok', true, 'adet', v_n);
end;
$fn$;

grant execute on function public.set_preferences(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) RPC: SENKRON ÇEK / GÖNDER
-- ---------------------------------------------------------------------------
-- sync_pull loglanmaz — bir tarayıcı dakikada bir çekebilir, denetim kaydını
-- gürültüye boğar ve asıl olayları görünmez kılar. Bunun yerine bağlantının
-- last_seen_at'i güncellenir. Yazma olayları (push) her zaman loglanır.

create or replace function public.sync_pull(
  p_app_key   text,
  p_data_type text default null
) returns table (
  data_type    text,
  payload      jsonb,
  version      bigint,
  is_encrypted boolean,
  updated_at   timestamptz
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'oturum yok' using errcode = '42501';
  end if;

  update public.app_connections
     set last_seen_at = now()
   where user_id = v_user and app_key = p_app_key and revoked_at is null;

  return query
    select d.data_type, d.payload, d.version, d.is_encrypted, d.updated_at
      from public.user_sync_data d
     where d.user_id = v_user
       and d.app_key = p_app_key
       and (p_data_type is null or d.data_type = p_data_type);
end;
$fn$;

grant execute on function public.sync_pull(text, text) to authenticated;

create or replace function public.sync_push(
  p_app_key          text,
  p_data_type        text,
  p_payload          jsonb,
  p_expected_version bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_cur  bigint;
  v_size int;
  v_lim  int := 5 * 1024 * 1024;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) not in ('object', 'array') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_veri');
  end if;
  if p_data_type is null or p_data_type !~ '^[a-z0-9_]{1,32}$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_tur');
  end if;
  if not exists (select 1 from public.integration_providers ip
                  where ip.key = p_app_key and ip.is_active) then
    return jsonb_build_object('ok', false, 'hata', 'uygulama_tanimsiz');
  end if;

  v_size := pg_column_size(p_payload);
  if v_size > v_lim then
    perform public.log_event('sync.push', v_user, p_app_key, 'user_sync_data', p_data_type,
                             'denied', 'warning', 'user',
                             jsonb_build_object('sebep', 'boyut_asildi', 'bayt', v_size));
    return jsonb_build_object('ok', false, 'hata', 'boyut_asildi',
                              'bayt', v_size, 'limit', v_lim);
  end if;

  select d.version into v_cur
    from public.user_sync_data d
   where d.user_id = v_user and d.app_key = p_app_key and d.data_type = p_data_type;

  -- İyimser kilit: istemci elindeki sürümü bildirirse ve arada başkası
  -- yazmışsa üzerine yazmıyoruz. Bildirmezse (null) eski davranış korunur.
  if p_expected_version is not null and v_cur is not null and v_cur <> p_expected_version then
    perform public.log_event('sync.push', v_user, p_app_key, 'user_sync_data', p_data_type,
                             'failure', 'notice', 'user',
                             jsonb_build_object('sebep', 'surum_catismasi',
                                                'beklenen', p_expected_version, 'mevcut', v_cur));
    return jsonb_build_object('ok', false, 'hata', 'surum_catismasi', 'mevcut_surum', v_cur);
  end if;

  insert into public.user_sync_data as s (user_id, app_key, data_type, payload, version)
  values (v_user, p_app_key, p_data_type, p_payload, 1)
  on conflict (user_id, app_key, data_type) do update
    set payload = excluded.payload,
        version = s.version + 1
  returning s.version into v_cur;

  perform public.log_event('sync.push', v_user, p_app_key, 'user_sync_data', p_data_type,
                           'success', 'info', 'user',
                           jsonb_build_object('surum', v_cur, 'bayt', v_size));

  return jsonb_build_object('ok', true, 'surum', v_cur, 'bayt', v_size);
end;
$fn$;

grant execute on function public.sync_push(text, text, jsonb, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) MEVCUT İLGEZDİ VERİSİNİ TAŞI
-- ---------------------------------------------------------------------------
-- ilgezdi_sync_data: 1 satır (417 yer imi + 22 klasör, 19 ayar anahtarı).
-- Kaynak tablo SİLİNMİYOR — İlgezdi istemcisi hâlâ ona yazıyor. Kesme
-- işlemi istemci yeni RPC'lere geçtikten sonra ayrı bir migration'da.

insert into public.user_sync_data (user_id, app_key, data_type, payload, version, updated_at)
select s.user_id, 'ilgezdi', 'bookmarks', s.bookmarks, 1, s.updated_at
  from public.ilgezdi_sync_data s
 where s.bookmarks is not null and s.bookmarks <> '{}'::jsonb
   and exists (select 1 from auth.users u where u.id = s.user_id)
on conflict (user_id, app_key, data_type) do nothing;

insert into public.user_sync_data (user_id, app_key, data_type, payload, version, updated_at)
select s.user_id, 'ilgezdi', 'settings', s.settings, 1, s.updated_at
  from public.ilgezdi_sync_data s
 where s.settings is not null and s.settings <> '{}'::jsonb
   and exists (select 1 from auth.users u where u.id = s.user_id)
on conflict (user_id, app_key, data_type) do nothing;

-- Senkron verisi olan herkes o uygulamaya bağlı sayılır.
insert into public.app_connections (user_id, app_key, connected_at, last_seen_at)
select distinct d.user_id, d.app_key, d.updated_at, d.updated_at
  from public.user_sync_data d
on conflict (user_id, app_key) do nothing;

-- ---------------------------------------------------------------------------
-- 8) ÖLÜ QR OTURUMLARININ TEMİZLİĞİ
-- ---------------------------------------------------------------------------
-- ilgezdi-qr edge fonksiyonu süresi dolmuş oturumu YALNIZCA sorgulandığında
-- expired'a çeviriyor. Hiç sorgulanmayan oturum sonsuza dek 'pending' kalıyor:
-- 01.07.2026'dan beri 10 tane birikmiş. Oturum belirteci taşıyan ölü satır.

create or replace function public.cleanup_expired_sessions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_expired int; v_deleted int;
begin
  -- 'approved' da dahil: kullanıcı onayladı ama tarayıcı hiç almadı —
  -- süresi dolmuş onaylı oturum da kullanılabilir bir belirteç taşıyor.
  update public.ilgezdi_qr_sessions
     set status = 'expired'
   where status in ('pending', 'approved') and expires_at < now();
  get diagnostics v_expired = row_count;

  -- 7 günden eski bitmiş oturumlar tutulmaz; belirteçleri gereksiz risk.
  delete from public.ilgezdi_qr_sessions
   where status in ('expired', 'used') and created_at < now() - interval '7 days';
  get diagnostics v_deleted = row_count;

  delete from public.partner_link_tokens where expires_at < now() - interval '1 day';
  delete from public.partner_tokens       where expires_at < now() - interval '1 day';
  delete from public.link_tokens          where expires_at < now() - interval '1 day';

  perform public.log_event('session.cleanup', null, 'qrtim', 'ilgezdi_qr_sessions', null,
                           'success', 'notice', 'internal',
                           jsonb_build_object('suresi_dolan', v_expired, 'silinen', v_deleted),
                           'system');

  return jsonb_build_object('suresi_dolan', v_expired, 'silinen', v_deleted);
end;
$fn$;

revoke all on function public.cleanup_expired_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_expired_sessions() to service_role;

select public.cleanup_expired_sessions();
