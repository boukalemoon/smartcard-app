-- ============================================================================
-- ADIM 5c — KRİTİK TABLOLARDA OTOMATİK DENETİM TETİKLEYİCİLERİ
-- ============================================================================
--
-- NEDEN TETİKLEYİCİ, NEDEN UYGULAMA KODU DEĞİL:
--   log_event yalnızca yeni RPC'lerden çağrılıyor. Ama uygulama profilleri,
--   organizasyonları, abonelikleri hâlâ DOĞRUDAN tabloya yazıyor. Logu
--   uygulama koduna serpiştirirsek: (a) unuttuğumuz her yol sessiz kalır,
--   (b) İlgezdi/Arku/Tinga kendi istemcilerinden yazdığında hiç iz kalmaz,
--   (c) service_role ile yapılan bir müdahale hiç görünmez.
--   Tetikleyici veritabanının kendisinde durur: hangi istemciden, hangi
--   anahtarla gelirse gelsin kayıt düşer.
--
-- NE KAYDEDİLİR, NE KAYDEDİLMEZ:
--   Satırın tam kopyası TUTULMAZ — denetim kaydı veritabanının ikinci bir
--   kopyası olmamalı, aksi halde kişisel veriyi iki katına çıkarırız.
--   Tutulan: hangi kolonlar değişti (yalnızca isimleri).
--   Değeriyle tutulan: yalnızca güvenlik açısından kritik kolonlar
--   (email, username, role, status, plan...) — hesap ele geçirme
--   incelemesinde "e-posta ne zaman neye çevrildi" sorusunun cevabı bu.
--
-- SUBJECT vs ACTOR:
--   İşlemi yapan ile kaydın sahibi farklı kişiler olabilir: organizasyon
--   yöneticisi üyenin kaydını değiştirebilir. Tek kolon ikisini anlatamaz.

-- ---------------------------------------------------------------------------
-- 1) audit_log: kaydın öznesi
-- ---------------------------------------------------------------------------

alter table public.audit_log
  add column if not exists subject_user_id uuid;

comment on column public.audit_log.actor_user_id is
  'İşlemi YAPAN kişi. Sistem/servis işlemlerinde null.';
comment on column public.audit_log.subject_user_id is
  'İşlemin KONUSU olan kişi (kaydın sahibi). Genelde actor ile aynıdır.';

create index if not exists audit_log_subject_idx
  on public.audit_log (subject_user_id, occurred_at desc);

-- Kullanıcı hem kendi yaptıklarını hem de KENDİSİYLE İLGİLİ yapılanları görür.
drop policy if exists "kullanici kendi denetim kaydini okur" on public.audit_log;
create policy "kullanici kendi denetim kaydini okur"
  on public.audit_log for select
  to authenticated
  using (
    visibility = 'user'
    and (actor_user_id = (select auth.uid()) or subject_user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 2) log_event — p_subject eklendi
-- ---------------------------------------------------------------------------
-- Parametre SONA ekleniyor: mevcut konumsal çağrılar (app_connect, sync_push,
-- set_preferences, cleanup_expired_sessions) olduğu gibi çalışmaya devam eder.

drop function if exists public.log_event(text,uuid,text,text,text,text,text,text,jsonb,text,uuid,text,text);

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
  p_user_agent    text    default null,
  p_subject       uuid    default null
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
    actor_kind, actor_user_id, subject_user_id, app_key, action,
    resource_type, resource_id, result, severity, visibility,
    correlation_id, ip, user_agent, meta
  ) values (
    v_kind, v_actor, coalesce(p_subject, v_actor), p_app_key, p_action,
    p_resource_type, p_resource_id,
    coalesce(p_result,'success'), coalesce(p_severity,'info'),
    coalesce(p_visibility,'user'), p_correlation,
    nullif(p_ip,'')::inet, nullif(p_user_agent,''), coalesce(p_meta,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
exception when others then
  insert into public.trigger_errors (source, context, sqlstate, message)
  values ('log_event',
          jsonb_build_object('action', p_action, 'actor', v_actor),
          sqlstate, sqlerrm);
  return null;
end;
$fn$;

revoke all on function public.log_event(text,uuid,text,text,text,text,text,text,jsonb,text,uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.log_event(text,uuid,text,text,text,text,text,text,jsonb,text,uuid,text,text,uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) my_activity — işlemi başkası yaptıysa görünsün
-- ---------------------------------------------------------------------------

drop function if exists public.my_activity(int,int);

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
  severity      text,
  baskasi_yapti boolean,
  meta          jsonb
)
language sql
stable
security invoker
set search_path = ''
as $fn$
  select a.occurred_at, a.action, a.app_key, p.name,
         a.resource_type, a.result, a.severity,
         (a.actor_user_id is distinct from auth.uid()),
         a.meta
    from public.audit_log a
    left join public.integration_providers p on p.key = a.app_key
   where a.visibility = 'user'
     and (a.actor_user_id = auth.uid() or a.subject_user_id = auth.uid())
   order by a.occurred_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$fn$;

grant execute on function public.my_activity(int,int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) GENEL DENETİM TETİKLEYİCİSİ
-- ---------------------------------------------------------------------------
-- TG_ARGV[0] = o tablodaki "sahip" kolonunun adı.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_owner_col  text  := tg_argv[0];
  -- 'auth'    -> kolon zaten auth.users.id
  -- 'profile' -> kolon profiles.id; ÇEVİRMEK gerekiyor. 36 profilin 9'unda
  --              id <> user_id (panelden elle açılmış eski kayıtlar). Çeviri
  --              olmasa o 9 kullanıcı kendi hareket geçmişini hiç göremezdi.
  v_owner_kind text  := coalesce(tg_argv[1], 'auth');
  v_row        jsonb;
  v_old        jsonb;
  v_actor      uuid  := auth.uid();
  v_raw        uuid;
  v_owner      uuid;
  v_changed   text[];
  v_detail    jsonb := '{}'::jsonb;
  v_sev       text  := 'info';
  -- Değeriyle birlikte kaydedilen kolonlar: hesap ele geçirme incelemesinde
  -- "ne zaman neye çevrildi" sorusunun cevabı bunlarda.
  v_watch     text[] := array['email','username','role','status','plan',
                              'is_verified','user_id','created_by',
                              'organization_id','is_admin'];
  -- Yalnızca bunlar değiştiyse kayıt açmaya değmez.
  v_ignore    text[] := array['updated_at','last_seen_at','updated_by',
                              'size_bytes','last_login_at','view_count'];
  k text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  begin
    v_raw := (v_row ->> v_owner_col)::uuid;
  exception when others then
    v_raw := null;
  end;

  if v_owner_kind = 'profile' and v_raw is not null then
    select p.user_id into v_owner from public.profiles p where p.id = v_raw;
  else
    v_owner := v_raw;
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);

    select array_agg(e.key order by e.key) into v_changed
      from jsonb_each(v_row) e
     where not (e.key = any(v_ignore))
       and e.value is distinct from (v_old -> e.key);

    -- Sadece zaman damgası döndüyse gürültü üretme.
    if v_changed is null then
      return null;
    end if;

    foreach k in array v_watch loop
      if k = any(v_changed) then
        v_sev    := 'notice';
        v_detail := v_detail || jsonb_build_object(
                      k, jsonb_build_object('eski', v_old -> k, 'yeni', v_row -> k));
      end if;
    end loop;

  elsif tg_op = 'DELETE' then
    v_sev := 'warning';
  end if;

  perform public.log_event(
    tg_table_name || '.' || lower(tg_op),
    v_actor,
    null,
    tg_table_name,
    coalesce(v_row ->> 'id', v_raw::text),
    'success',
    v_sev,
    case when v_actor is not null and v_actor = v_owner then 'user' else 'internal' end,
    jsonb_strip_nulls(jsonb_build_object(
      'degisen', to_jsonb(v_changed),
      'detay',   nullif(v_detail, '{}'::jsonb))),
    case when v_actor is null then 'service' else 'user' end,
    null, null, null,
    v_owner
  );

  return null;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5) TETİKLEYİCİLERİ BAĞLA
-- ---------------------------------------------------------------------------
-- Yüksek hacimli analiz tabloları (analytics_events, card_analytics) bilerek
-- DIŞARIDA: denetim kaydını gürültüye boğar, asıl olayları görünmez kılar.

drop trigger if exists audit_profiles_trg on public.profiles;
create trigger audit_profiles_trg after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change('user_id', 'auth');

drop trigger if exists audit_profile_fields_trg on public.profile_fields;
create trigger audit_profile_fields_trg after insert or update or delete on public.profile_fields
  for each row execute function public.audit_row_change('profile_id', 'profile');

drop trigger if exists audit_social_links_trg on public.social_links;
create trigger audit_social_links_trg after insert or update or delete on public.social_links
  for each row execute function public.audit_row_change('profile_id', 'profile');

drop trigger if exists audit_subscriptions_trg on public.subscriptions;
create trigger audit_subscriptions_trg after insert or update or delete on public.subscriptions
  for each row execute function public.audit_row_change('profile_id', 'profile');

drop trigger if exists audit_members_trg on public.members;
create trigger audit_members_trg after insert or update or delete on public.members
  for each row execute function public.audit_row_change('profile_id', 'profile');

drop trigger if exists audit_organizations_trg on public.organizations;
create trigger audit_organizations_trg after insert or update or delete on public.organizations
  for each row execute function public.audit_row_change('created_by', 'profile');

drop trigger if exists audit_nfc_orders_trg on public.nfc_orders;
create trigger audit_nfc_orders_trg after insert or update or delete on public.nfc_orders
  for each row execute function public.audit_row_change('profile_id', 'profile');

drop trigger if exists audit_profile_payment_trg on public.profile_payment;
create trigger audit_profile_payment_trg after insert or update or delete on public.profile_payment
  for each row execute function public.audit_row_change('profile_id', 'profile');
