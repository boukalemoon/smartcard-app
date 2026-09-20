-- ============================================================================
-- BASILI KARTIN ÖMRÜ: KALICI KART KODU + KULLANICI ADI GEÇMİŞİ
-- ============================================================================
--
-- SORUN (20.09.2026 incelemesi):
--   Basılan QR ve NFC kart `/card/<kullanıcı-adı>` adresini taşıyor. Kullanıcı
--   adını değiştirdiği anda elindeki BÜTÜN kartlar ölüyor; kurumlarda eski
--   adresi yeniye taşıyan yönlendirme var, kişisel kartlarda YOK.
--   Ayrıca ana kartın adresi iptal edilemiyordu: kart kaybolur/çalınırsa
--   adres sonsuza kadar açık kalıyordu (alt profillerde kod yenileme vardı).
--
-- ÇÖZÜM:
--   1) Her profile KALICI bir kart kodu. Basılan kart artık kullanıcı adına
--      değil bu koda bakar; ad değişse de kart yaşar. Kod "hangi profil ana
--      profilse onu göster" diye çözülür — yani basılan kart sonradan başka
--      bir profile yönlendirilebilir.
--   2) Kart kaybolursa kod yenilenebilir (rotate): eski baskılar bilerek ölür.
--   3) Kullanıcı adı değişirse eskisi geçmişte tutulur; o adrese gelen
--      ziyaretçi yine doğru kartı görür — ESKİ AD BAŞKASINA VERİLMEDİYSE.

-- ---------------------------------------------------------------------------
-- 1) Kalıcı kart kodu
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists card_code text,
  add column if not exists card_code_rotated_at timestamptz;

update public.profiles set card_code = public.new_share_code() where card_code is null;

-- Aynı kod uzayını personas.share_code ile paylaşıyoruz (12 karakter, aynı
-- alfabe). Çakışma olasılığı yok denecek kadar düşük ama kontrol ediliyor.
do $kod$
declare v_tekrar int;
begin
  loop
    update public.profiles p
       set card_code = public.new_share_code()
     where exists (select 1 from public.personas x where x.share_code = p.card_code);
    get diagnostics v_tekrar = row_count;
    exit when v_tekrar = 0;
  end loop;
end
$kod$;

alter table public.profiles alter column card_code set not null;
create unique index if not exists profiles_card_code_key on public.profiles (card_code);

comment on column public.profiles.card_code is
  'Basılı QR/NFC kartların kalıcı adresi (/k/<kod>). Kullanıcı adı değişse de çalışır; kart kaybolursa rotate_card_code ile yenilenir.';

-- Yeni kayıtlarda otomatik üretilsin.
alter table public.profiles alter column card_code set default public.new_share_code();

-- ---------------------------------------------------------------------------
-- 2) Kullanıcı adı geçmişi
-- ---------------------------------------------------------------------------
create table if not exists public.profile_username_history (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  username    text not null,
  changed_at  timestamptz not null default now()
);

create index if not exists profile_username_history_username_idx
  on public.profile_username_history (lower(username));

alter table public.profile_username_history enable row level security;
-- Politika yok: yalnızca sunucu tarafı okur (get_public_card SECURITY DEFINER).
revoke all on public.profile_username_history from anon, authenticated;

comment on table public.profile_username_history is
  'Eski kullanıcı adları. Daha önce basılmış kartlar (eski /card/<ad> adresi) çalışmaya devam etsin diye tutulur.';

create or replace function public.profiles_username_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.username is distinct from old.username and old.username is not null then
    insert into public.profile_username_history (profile_id, username)
    values (old.id, old.username);
    perform public.log_event('profile.username_changed', auth.uid(), 'qrtim', 'profile',
                             old.id::text, 'success', 'notice', 'user',
                             jsonb_build_object('eski', old.username, 'yeni', new.username));
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_username_history_trg on public.profiles;
create trigger profiles_username_history_trg
  after update of username on public.profiles
  for each row execute function public.profiles_username_history();

-- ---------------------------------------------------------------------------
-- 3) Kart çözümü: kod → (persona | profil), ad → (profil | eski ad)
-- ---------------------------------------------------------------------------
-- Koddan persona çöz: önce persona kodu, sonra profilin kalıcı kart kodu
-- (o durumda ANA profil gösterilir).
create or replace function public.resolve_card_code(p_code text)
returns table (profil_id uuid, persona_id uuid)
language sql
stable
security definer
set search_path = ''
as $fn$
  select x.profile_id, x.id from public.personas x where x.share_code = p_code
  union all
  select p.id, x.id
    from public.profiles p
    join public.personas x on x.profile_id = p.id and x.is_primary
   where p.card_code = p_code
     and not exists (select 1 from public.personas y where y.share_code = p_code)
  limit 1;
$fn$;

revoke all on function public.resolve_card_code(text) from public, anon, authenticated;

create or replace function public.get_public_card_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_prof uuid; v_persona uuid;
begin
  if p_code is null or length(p_code) > 40 then
    return null;
  end if;
  if not public.check_rate_limit('card:' || public.request_client_ip(), 120, 600) then
    raise exception 'Cok fazla istek. Lutfen biraz bekleyin.' using errcode = '53400';
  end if;

  select r.profil_id, r.persona_id into v_prof, v_persona
    from public.resolve_card_code(p_code) r;
  if v_persona is null then return null; end if;
  return public.build_public_card(v_prof, v_persona);
end;
$fn$;

revoke all on function public.get_public_card_by_code(text) from public;
grant execute on function public.get_public_card_by_code(text) to anon, authenticated;

-- Kullanıcı adı: önce mevcut, bulunamazsa ESKİ ad (başkasına verilmediyse).
create or replace function public.get_public_card(p_username text, p_persona text default 'default')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_prof uuid; v_persona uuid;
begin
  if p_username is null or length(p_username) > 100 then
    return null;
  end if;
  if not public.check_rate_limit('card:' || public.request_client_ip(), 120, 600) then
    raise exception 'Cok fazla istek. Lutfen biraz bekleyin.' using errcode = '53400';
  end if;

  select id into v_prof from public.profiles where username = p_username;

  -- Eski ad: yalnızca bugün kimsenin üzerinde değilse geçerlidir; aksi hâlde
  -- adı yeni alan kişinin kartı gösterilirdi.
  if v_prof is null then
    select h.profile_id into v_prof
      from public.profile_username_history h
     where lower(h.username) = lower(p_username)
     order by h.changed_at desc
     limit 1;
  end if;

  if v_prof is null then return null; end if;

  if p_persona is null or p_persona = 'default' then
    select id into v_persona from public.personas where profile_id = v_prof and is_primary;
  else
    select id into v_persona from public.personas where profile_id = v_prof and share_code = p_persona;
  end if;

  if v_persona is null then return null; end if;
  return public.build_public_card(v_prof, v_persona);
end;
$fn$;

revoke all on function public.get_public_card(text, text) from public;
grant execute on function public.get_public_card(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Hareket kaydı da aynı çözümü kullansın
-- ---------------------------------------------------------------------------
create or replace function public.track_card_event(
  p_event    text,
  p_username text default null,
  p_code     text default null,
  p_source   text default null,
  p_meta     jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_x        public.personas;
  v_sahibi   uuid;
  v_kaynak   text := lower(nullif(btrim(coalesce(p_source, '')), ''));
  v_limit    int;
  v_prof     uuid;
  v_persona  uuid;
begin
  if p_event not in ('profile_view','qr_scan','nfc_tap','vcard_download','link_click','share') then
    return;
  end if;
  if v_kaynak is not null and v_kaynak not in ('qr','nfc','link','direct') then
    v_kaynak := null;
  end if;

  if p_code is not null and length(p_code) <= 40 then
    select r.persona_id into v_persona from public.resolve_card_code(p_code) r;
    if v_persona is not null then
      select * into v_x from public.personas where id = v_persona;
    end if;
  elsif p_username is not null and length(p_username) <= 100 then
    select id into v_prof from public.profiles where username = p_username;
    if v_prof is null then
      select h.profile_id into v_prof from public.profile_username_history h
       where lower(h.username) = lower(p_username)
       order by h.changed_at desc limit 1;
    end if;
    if v_prof is not null then
      select * into v_x from public.personas where profile_id = v_prof and is_primary;
    end if;
  end if;

  if v_x.id is null or v_x.status <> 'active' then
    return;
  end if;

  select p.user_id into v_sahibi from public.profiles p where p.id = v_x.profile_id;
  if v_sahibi is not null and v_sahibi = auth.uid() then
    return;
  end if;

  v_limit := case when p_event in ('profile_view','qr_scan','nfc_tap') then 10 else 30 end;
  if not public.check_rate_limit(
       'olay:' || p_event || ':' || public.request_client_ip() || ':' || v_x.id::text,
       v_limit, 3600) then
    return;
  end if;

  insert into public.analytics_events (profile_id, persona_id, event_type, source, metadata)
  values (v_x.profile_id, v_x.id, p_event, v_kaynak,
          coalesce(p_meta, '{}'::jsonb) - 'ip' - 'email' - 'phone');

  if p_event in ('profile_view','qr_scan','nfc_tap') then
    update public.personas set view_count = coalesce(view_count,0) + 1, last_viewed_at = now()
     where id = v_x.id;
    update public.profiles set card_views = coalesce(card_views,0) + 1, last_viewed_at = now()
     where id = v_x.profile_id;
  end if;
end;
$fn$;

revoke all on function public.track_card_event(text,text,text,text,jsonb) from public;
grant execute on function public.track_card_event(text,text,text,text,jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Kart kodunu yenileme (kayıp/çalıntı kart)
-- ---------------------------------------------------------------------------
create or replace function public.rotate_card_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_prof uuid := public.my_profile_id(); v_eski text; v_yeni text;
begin
  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  -- Kötüye kullanım ve kazara tıklamaya karşı: saatte 3 yenileme.
  if not public.check_rate_limit('kart-kodu:' || v_prof::text, 3, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  select card_code into v_eski from public.profiles where id = v_prof;

  loop
    v_yeni := public.new_share_code();
    exit when not exists (select 1 from public.personas where share_code = v_yeni)
          and not exists (select 1 from public.profiles where card_code = v_yeni);
  end loop;

  update public.profiles
     set card_code = v_yeni, card_code_rotated_at = now()
   where id = v_prof;

  perform public.log_event('card.code_rotated', auth.uid(), 'qrtim', 'profile', v_prof::text,
                           'success', 'notice', 'user',
                           jsonb_build_object('eski_kod_gecersiz', true));

  return jsonb_build_object('ok', true, 'kod', v_yeni, 'eski_kod', v_eski);
end;
$fn$;

revoke all on function public.rotate_card_code() from public, anon;
grant execute on function public.rotate_card_code() to authenticated;

-- Kart kodu istemciden yazılamaz (guard_profile_privileged_columns'a ek).
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.role := 'user';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Yetki hatasi: role kolonu degistirilemez'
      using errcode = '42501';
  end if;

  if not public.is_admin() then
    new.subscription_plan       := old.subscription_plan;
    new.subscription_status     := old.subscription_status;
    new.subscription_expires_at := old.subscription_expires_at;
    new.nfc_cards_included      := old.nfc_cards_included;
    new.referral_earnings       := old.referral_earnings;

    if new.email is distinct from old.email then
      perform public.log_protected_write('profile', old.id::text, array['email']);
      new.email := old.email;
    end if;

    -- Kart kodu yalnızca rotate_card_code ile değişir.
    if new.card_code is distinct from old.card_code then
      perform public.log_protected_write('profile', old.id::text, array['card_code']);
      new.card_code := old.card_code;
    end if;
  end if;

  return new;
end;
$fn$;
