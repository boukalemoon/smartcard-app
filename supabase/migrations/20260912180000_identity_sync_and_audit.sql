-- ============================================================================
-- ADIM 5 — DİJİTAL KİMLİK: KULLANICI SENKRONİZASYONU + DENETİM KAYDI
-- ============================================================================
--
-- HEDEF (kullanıcının tarifi):
--   QRtım artık bir kartvizit değil, KİMLİK ve DOĞRULAMA katmanı. Kullanıcı
--   QRtım hesabıyla bağlandığı her uygulamada (İlgezdi, Arku, Tinga, sonra
--   şirket turnikeleri) aynı kişidir; tercihleri merkezde durur ve uygulamalar
--   davranışlarını bu tercihlere göre ayarlar.
--
-- BUGÜNKÜ DURUM (ölçüldü, 12.09.2026):
--   • Uygulama başına ayrı tablo: ilgezdi_sync_data, ilgezdi_profiles,
--     ilgezdi_qr_sessions. Arku/Tinga için hiç senkron yok. Dördüncü uygulama
--     dördüncü tablo takımı demek — sürdürülemez.
--   • Kullanıcı tercihi diye bir kavram yok. İlgezdi ayarlarını kendi
--     jsonb'sinde tutuyor, başka hiçbir uygulama göremiyor.
--   • DENETİM KAYDI HİÇ YOK. 47 tablonun hiçbiri "kim, ne zaman, neyi,
--     nereden değiştirdi" sorusunu cevaplayamıyor. Bir hesap ele geçse
--     geriye dönüp bakabileceğimiz tek satır yok.
--
-- BU MIGRATION NE YAPMIYOR:
--   Site şifresi saklamıyor. Kasa yok. Uçtan uca şifreleme bu aşamada
--   kapsamda değil; şifreleme YOLUNU açık bırakıyor (is_encrypted/enc_version
--   kolonları) ama anahtar yönetimi ayrı bir karar.

-- ---------------------------------------------------------------------------
-- 1) UYGULAMA KÜNYESİ
-- ---------------------------------------------------------------------------
-- integration_providers zaten kayıt defteri (arku/ilgezdi/tinga). Kendi
-- uygulamalarımız ile dışarıdan entegre olacak sistemleri (turnike vb.)
-- ayırt edebilmek için tek kolon ekliyoruz.

alter table public.integration_providers
  add column if not exists is_first_party boolean not null default false;

update public.integration_providers
   set is_first_party = true
 where key in ('arku', 'ilgezdi', 'tinga');

-- Mevcut kısıt kind'ı sso/access_control/hr/crm/signal/other ile sınırlıyordu.
-- QRtım'ın kendisi bunların hiçbiri değil — kimlik sağlayıcının kendisi.
alter table public.integration_providers
  drop constraint if exists integration_providers_kind_check;
alter table public.integration_providers
  add constraint integration_providers_kind_check
  check (kind in ('identity','sso','access_control','hr','crm','signal','other'));

insert into public.integration_providers (key, name, kind, capabilities, is_active, is_first_party)
values ('qrtim', 'QRtim', 'identity',
        '{"sso": true, "sync": true, "identity": true}'::jsonb, true, true)
on conflict (key) do nothing;

comment on column public.integration_providers.is_first_party is
  'true = bizim uygulamamız (QRtım hesabı birincil kimlik). false = dış sistem (turnike, CRM).';

-- RLS açık ama TEK politika yoktu: giriş yapmış kullanıcı künyenin hiçbir
-- satırını okuyamıyordu. Sonucu: bağlanılabilir uygulamaları listeleyemiyoruz
-- ve denetim kaydında uygulama adı hep boş kalırdı. Künyede sır yok
-- (sırlar integrations.secret_ref'te), etkin satırlar okumaya açılıyor.

drop policy if exists "etkin uygulama kunyesi okunabilir" on public.integration_providers;
create policy "etkin uygulama kunyesi okunabilir"
  on public.integration_providers for select
  to authenticated
  using (is_active);

-- ---------------------------------------------------------------------------
-- 2) DENETİM KAYDI (audit_log)
-- ---------------------------------------------------------------------------
-- Kimlik sağlayıcı olacaksak log tartışmaya kapalı bir gereklilik: kullanıcı
-- "hesabımda ne oldu" diye sorabilmeli, biz de bir olayı geriye sarabilmeliyiz.
--
-- Tasarım kararları:
--   • SALT EKLEME (append-only). UPDATE tetikleyici ile tamamen yasak;
--     DELETE yalnızca saklama süresi dolmuş satırlar için. Servis anahtarımız
--     ele geçse bile izler anında silinemez.
--   • visibility: 'user' satırlarını kullanıcı kendi geçmişinde görür,
--     'internal' satırlarını yalnızca service_role görür.
--   • correlation_id: bir akış birden çok uygulamaya yayıldığında
--     (QR giriş -> token -> senkron) satırları birbirine bağlar.

create table if not exists public.audit_log (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_kind     text        not null default 'user',
  actor_user_id  uuid,
  app_key        text,
  action         text        not null,
  resource_type  text,
  resource_id    text,
  result         text        not null default 'success',
  severity       text        not null default 'info',
  visibility     text        not null default 'user',
  correlation_id uuid,
  ip             inet,
  user_agent     text,
  meta           jsonb       not null default '{}',
  constraint audit_log_actor_kind_chk  check (actor_kind in ('user','service','system','app','anon')),
  constraint audit_log_result_chk      check (result     in ('success','failure','denied')),
  constraint audit_log_severity_chk    check (severity   in ('info','notice','warning','critical')),
  constraint audit_log_visibility_chk  check (visibility in ('user','internal'))
);

comment on table public.audit_log is
  'Salt-ekleme denetim kaydı. UPDATE yasak, DELETE yalnızca 90 günden eski satırlar için.';

create index if not exists audit_log_time_idx   on public.audit_log (occurred_at desc);
create index if not exists audit_log_actor_idx  on public.audit_log (actor_user_id, occurred_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, occurred_at desc);
create index if not exists audit_log_app_idx    on public.audit_log (app_key, occurred_at desc) where app_key is not null;
create index if not exists audit_log_alarm_idx  on public.audit_log (occurred_at desc)
  where severity in ('warning','critical') or result <> 'success';
create index if not exists audit_log_corr_idx   on public.audit_log (correlation_id) where correlation_id is not null;

-- Değiştirilemezlik koruması
create or replace function public.audit_log_guard()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'UPDATE' then
    raise exception 'audit_log satirlari degistirilemez (salt-ekleme)'
      using errcode = '42501';
  end if;

  -- DELETE: yalnızca saklama süresi dolmuş satırlar temizlenebilir.
  if old.occurred_at > now() - interval '90 days' then
    raise exception 'audit_log satiri saklama suresi dolmadan silinemez (%)', old.occurred_at
      using errcode = '42501';
  end if;

  return old;
end;
$fn$;

drop trigger if exists audit_log_guard_trg on public.audit_log;
create trigger audit_log_guard_trg
  before update or delete on public.audit_log
  for each row execute function public.audit_log_guard();

alter table public.audit_log enable row level security;

-- Kullanıcı yalnızca kendi görünür olaylarını okur. INSERT/UPDATE/DELETE
-- politikası YOK => istemci hiçbir şekilde yazamaz, sahte kayıt üretemez.
drop policy if exists "kullanici kendi denetim kaydini okur" on public.audit_log;
create policy "kullanici kendi denetim kaydini okur"
  on public.audit_log for select
  to authenticated
  using (actor_user_id = (select auth.uid()) and visibility = 'user');

-- ---------------------------------------------------------------------------
-- 3) LOG YAZMA YARDIMCISI
-- ---------------------------------------------------------------------------
-- Yalnızca sunucu tarafı çağırır (service_role ve SECURITY DEFINER
-- fonksiyonlarımızın içinden). İstemciye açılmaz: açılsaydı kullanıcı kendi
-- denetim kaydını uydurabilirdi.
--
-- Log yazımı çağıranı ASLA düşürmez: hata olursa trigger_errors'a düşer.

create or replace function public.log_event(
  p_action        text,
  p_actor_user_id uuid    default null,
  p_app_key       text    default null,
  p_resource_type text    default null,
  p_resource_id   text    default null,
  p_result        text    default 'success',
  p_severity      text    default 'info',
  p_visibility    text    default 'user',
  p_meta          jsonb   default '{}'::jsonb,
  p_actor_kind    text    default null,
  p_correlation   uuid    default null,
  p_ip            text    default null,
  p_user_agent    text    default null
) returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := coalesce(p_actor_user_id, auth.uid());
  v_kind  text := coalesce(p_actor_kind, case when v_actor is null then 'service' else 'user' end);
  v_id    bigint;
begin
  insert into public.audit_log (
    actor_kind, actor_user_id, app_key, action, resource_type, resource_id,
    result, severity, visibility, correlation_id, ip, user_agent, meta
  ) values (
    v_kind, v_actor, p_app_key, p_action, p_resource_type, p_resource_id,
    coalesce(p_result,'success'), coalesce(p_severity,'info'),
    coalesce(p_visibility,'user'), p_correlation,
    nullif(p_ip,'')::inet, nullif(p_user_agent,''), coalesce(p_meta,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
exception when others then
  -- Log yazamamak işlemi bozmaz ama sessiz de kalmaz.
  insert into public.trigger_errors (source, context, sqlstate, message)
  values ('log_event',
          jsonb_build_object('action', p_action, 'actor', v_actor),
          sqlstate, sqlerrm);
  return null;
end;
$fn$;

revoke all on function public.log_event(text,uuid,text,text,text,text,text,text,jsonb,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.log_event(text,uuid,text,text,text,text,text,text,jsonb,text,uuid,text,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4) KULLANICI KENDİ HAREKET GEÇMİŞİNİ GÖRÜR
-- ---------------------------------------------------------------------------
-- Hem kimlik ürününün doğal parçası hem de KVKK'nın istediği şeffaflık.

create or replace function public.my_activity(
  p_limit  int default 50,
  p_offset int default 0
) returns table (
  occurred_at   timestamptz,
  action        text,
  app_key       text,
  app_name      text,
  resource_type text,
  result        text,
  meta          jsonb
)
language sql
stable
security invoker
set search_path = ''
as $fn$
  select a.occurred_at, a.action, a.app_key, p.name,
         a.resource_type, a.result, a.meta
    from public.audit_log a
    left join public.integration_providers p on p.key = a.app_key
   where a.actor_user_id = auth.uid()
     and a.visibility = 'user'
   order by a.occurred_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$fn$;

grant execute on function public.my_activity(int,int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) SAKLAMA SÜRESİ TEMİZLİĞİ
-- ---------------------------------------------------------------------------

create or replace function public.prune_audit_log(p_keep_days int default 400)
returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_days int := greatest(90, coalesce(p_keep_days, 400)); v_n int;
begin
  delete from public.audit_log where occurred_at < now() - (v_days || ' days')::interval;
  get diagnostics v_n = row_count;

  perform public.log_event(
    'audit.prune', null, 'qrtim', 'audit_log', null,
    'success', 'notice', 'internal',
    jsonb_build_object('silinen', v_n, 'saklama_gun', v_days), 'system');

  return v_n;
end;
$fn$;

revoke all on function public.prune_audit_log(int) from public, anon, authenticated;
grant execute on function public.prune_audit_log(int) to service_role;
