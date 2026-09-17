-- ============================================================================
-- ÜYE TAKİBİ VE PERFORMANS ANALİZİ — SAĞLAM TEMEL
-- ============================================================================
--
-- TESPİT (17–18.09.2026 panel analizi):
--   1) QR ve NFC hiç ölçülmüyordu. Olay türü listesinde 'qr_scan' ve 'nfc_tap'
--      vardı ama hiçbir yerden yazılmıyordu; kurum panelindeki "QR Tarama"
--      sütunu hep 0 ve tablo bu sütuna göre sıralanıyordu.
--   2) Sahte veri yazılabiliyordu: analytics_events üzerinde üç ayrı INSERT
--      politikası "herkes, her satırı" diyordu. Giriş yapmamış biri bile
--      istediği kişi adına istediği kadar görüntülenme yazabiliyordu.
--      Performans sıralaması yapacaksak bu kabul edilemez.
--   3) Üç ayrı sayaç, üç ayrı sayı: profiles.card_views=188,
--      analytics_events profile_view=119, personas.view_count=1.
--   4) Paylaş düğmeleri (WhatsApp/SMS/e-posta/bağlantı kopyala) olay türü
--      kısıtına takılıyor, sessizce kayboluyordu.
--   5) Analitik kurum bazlı değildi: kişinin BÜTÜN görüntülenmeleri (üyelikten
--      önceki dönem ve kurumla ilgisiz profilleri dahil) her kurumda sayılıyordu.
--   6) Tarih aralığı yoktu; panel "bu ay" deyip tüm zamanları gösteriyordu.
--   7) Kişinin kendi kartına bakması da görüntülenme sayılıyordu.
--
-- ÇÖZÜM:
--   • Olay yazmanın TEK yolu track_card_event(): kaynak (qr/nfc/link/direct),
--     profil (persona), hız sınırı ve sahiplik kontrolü içeride.
--   • İstemcinin doğrudan yazması kapatıldı.
--   • Sayaçlar tek yerden güncelleniyor.
--   • Kurum raporları tarih aralıklı ve üyelik tarihinden itibaren.

-- ---------------------------------------------------------------------------
-- 1) Olay tablosu: kaynak ve profil boyutu
-- ---------------------------------------------------------------------------

alter table public.analytics_events
  add column if not exists persona_id uuid references public.personas(id) on delete set null,
  add column if not exists source text;

alter table public.analytics_events drop constraint if exists analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check
  check (event_type in ('profile_view','qr_scan','nfc_tap','vcard_download','link_click','share'));

alter table public.analytics_events drop constraint if exists analytics_events_source_check;
alter table public.analytics_events add constraint analytics_events_source_check
  check (source is null or source in ('qr','nfc','link','direct'));

comment on column public.analytics_events.source is
  'Ziyaretçi karta nereden geldi: qr (QR kod), nfc (kart okutma), link (paylaşılan bağlantı), direct (doğrudan adres). Eski kayıtlarda boş.';
comment on column public.analytics_events.persona_id is
  'Hangi profil (persona) görüntülendi. Eski kayıtlarda boş.';

create index if not exists idx_ae_profile_created on public.analytics_events (profile_id, created_at desc);
create index if not exists idx_ae_persona_created on public.analytics_events (persona_id, created_at desc);
-- Çift indeksler temizleniyor (aynı kolonda iki indeks vardı).
drop index if exists public.idx_analytics_created;
drop index if exists public.idx_analytics_type;

-- ---------------------------------------------------------------------------
-- 2) Olay yazmanın tek yolu
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
  v_x      public.personas;
  v_sahibi uuid;
  v_kaynak text := lower(nullif(btrim(coalesce(p_source, '')), ''));
  v_limit  int;
begin
  if p_event not in ('profile_view','qr_scan','nfc_tap','vcard_download','link_click','share') then
    return;
  end if;
  if v_kaynak is not null and v_kaynak not in ('qr','nfc','link','direct') then
    v_kaynak := null;
  end if;

  if p_code is not null and length(p_code) <= 40 then
    select * into v_x from public.personas where share_code = p_code;
  elsif p_username is not null and length(p_username) <= 100 then
    select x.* into v_x from public.personas x
      join public.profiles p on p.id = x.profile_id
     where p.username = p_username and x.is_primary;
  end if;
  if v_x.id is null or v_x.status <> 'active' then
    return;
  end if;

  -- Kişinin kendi kartına bakması sayılmaz.
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

  -- Sayaçlar TEK yerden güncellenir.
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

-- Eski arayüz hâlâ canlıda: increment_card_view artık aynı yolu kullanıyor,
-- böylece dağıtım yapılana kadar görüntülenmeler kaybolmaz.
create or replace function public.increment_card_view(
  p_username text default null,
  p_code text default null
) returns void
language sql
security definer
set search_path = ''
as $fn$
  select public.track_card_event('profile_view', p_username, p_code, 'direct', '{}'::jsonb);
$fn$;

revoke all on function public.increment_card_view(text,text) from public;
grant execute on function public.increment_card_view(text,text) to anon, authenticated;

-- İstemci artık doğrudan olay yazamaz.
drop policy if exists "Anon insert analytics events" on public.analytics_events;
drop policy if exists "Anyone can insert analytics" on public.analytics_events;
drop policy if exists "Anyone insert analytics events" on public.analytics_events;
drop policy if exists "Users can view own analytics" on public.analytics_events;
drop policy if exists "Users view own events" on public.analytics_events;

create policy "kisi kendi olaylarini gorur" on public.analytics_events
  for select to authenticated
  using (profile_id = public.my_profile_id());

revoke insert, update, delete on table public.analytics_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Kurum raporları — tarih aralıklı, üyelikten itibaren
-- ---------------------------------------------------------------------------

-- Tarih sınırları GÜN'e yuvarlanır: bitiş olarak "şimdi" gönderilse bile
-- bugünkü hareketler rapora girer (testte bu yüzden bugün boş görünmüştü).
-- Görüntülenme KAYNAĞA göre ayrışır: kart hep 'profile_view' yazar, karta
-- nereden gelindiği source alanındadır (qr / nfc / link / direct).
create or replace function public.org_member_analytics(
  p_org_id uuid,
  p_from   timestamptz default null,
  p_to     timestamptz default null
) returns table (
  member_id uuid, profile_id uuid, name text, avatar_url text, role text, status text,
  joined_at timestamptz, has_account boolean,
  profile_views bigint, qr_views bigint, nfc_views bigint, link_views bigint, direct_views bigint,
  vcard_downloads bigint, link_clicks bigint, shares bigint,
  total bigint, last_activity timestamptz
)
language sql
stable
security definer
set search_path = ''
as $fn$
  with s as (
    select case when p_from is null then null else date_trunc('day', p_from) end as bas,
           case when p_to   is null then null else date_trunc('day', p_to) + interval '1 day' end as bit
  )
  select m.id, m.profile_id,
         coalesce(public.unquote_text(m.name), p.name, 'İsimsiz üye'),
         p.avatar_url, m.role, m.status,
         coalesce(m.joined_at, m.created_at),
         (m.profile_id is not null),
         count(*) filter (where e.event_type in ('profile_view','qr_scan','nfc_tap')),
         count(*) filter (where e.event_type in ('profile_view','qr_scan','nfc_tap') and (e.source = 'qr'  or e.event_type = 'qr_scan')),
         count(*) filter (where e.event_type in ('profile_view','qr_scan','nfc_tap') and (e.source = 'nfc' or e.event_type = 'nfc_tap')),
         count(*) filter (where e.event_type = 'profile_view' and e.source = 'link'),
         count(*) filter (where e.event_type = 'profile_view' and coalesce(e.source, 'direct') = 'direct'),
         count(*) filter (where e.event_type = 'vcard_download'),
         count(*) filter (where e.event_type = 'link_click'),
         count(*) filter (where e.event_type = 'share'),
         count(e.id),
         max(e.created_at)
    from public.members m
    cross join s
    left join public.profiles p on p.id = m.profile_id
    left join public.analytics_events e
           on e.profile_id = m.profile_id
          -- Üyelikten ÖNCEKİ hareketler kuruma yazılmaz.
          and e.created_at >= coalesce(m.joined_at, m.created_at)
          and (s.bas is null or e.created_at >= s.bas)
          and (s.bit is null or e.created_at <  s.bit)
   where m.organization_id = p_org_id
     and public.is_admin_of_org(p_org_id)
   group by m.id, m.profile_id, m.name, p.name, p.avatar_url, m.role, m.status,
            coalesce(m.joined_at, m.created_at)
   order by count(e.id) desc, coalesce(public.unquote_text(m.name), p.name);
$fn$;

revoke all on function public.org_member_analytics(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.org_member_analytics(uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.org_activity_series(
  p_org_id uuid,
  p_from   timestamptz default null,
  p_to     timestamptz default null
) returns table (gun date, profile_views bigint, qr_views bigint, nfc_views bigint,
                 vcard_downloads bigint, link_clicks bigint, shares bigint, total bigint)
language sql
stable
security definer
set search_path = ''
as $fn$
  with aralik as (
    select date_trunc('day', coalesce(p_from, now() - interval '30 days'))     as bas,
           date_trunc('day', coalesce(p_to, now())) + interval '1 day'         as bit
  ),
  gunler as (
    select generate_series(date_trunc('day', (select bas from aralik)),
                           date_trunc('day', (select bit from aralik) - interval '1 second'),
                           interval '1 day')::date as gun
  ),
  olaylar as (
    select e.created_at::date gun, e.event_type, e.source
      from public.members m
      join public.analytics_events e
        on e.profile_id = m.profile_id
       and e.created_at >= coalesce(m.joined_at, m.created_at)
     where m.organization_id = p_org_id
       and e.created_at >= (select bas from aralik)
       and e.created_at <  (select bit from aralik)
  )
  select g.gun,
         count(*) filter (where o.event_type in ('profile_view','qr_scan','nfc_tap')),
         count(*) filter (where o.source = 'qr'  or o.event_type = 'qr_scan'),
         count(*) filter (where o.source = 'nfc' or o.event_type = 'nfc_tap'),
         count(*) filter (where o.event_type = 'vcard_download'),
         count(*) filter (where o.event_type = 'link_click'),
         count(*) filter (where o.event_type = 'share'),
         count(o.gun)
    from gunler g
    left join olaylar o on o.gun = g.gun
   where public.is_admin_of_org(p_org_id)
   group by g.gun
   order by g.gun;
$fn$;

revoke all on function public.org_activity_series(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.org_activity_series(uuid,timestamptz,timestamptz) to authenticated;

-- Tek üyenin dökümü: toplamlar, günlük seri, kaynak dağılımı, hangi profili
-- görüntülenmiş, en çok tıklanan bağlantılar.
create or replace function public.org_member_detail(
  p_org_id     uuid,
  p_profile_id uuid,
  p_from       timestamptz default null,
  p_to         timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_m   public.members;
  v_bas timestamptz;
  v_bit timestamptz := coalesce(p_to, now() + interval '1 day');
begin
  if not public.is_admin_of_org(p_org_id) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  select * into v_m from public.members
   where organization_id = p_org_id and profile_id = p_profile_id;
  if not found then
    return jsonb_build_object('ok', false, 'hata', 'uye_bulunamadi');
  end if;

  -- Üyelikten önceki hareketler bu kuruma ait sayılmaz.
  v_bit := date_trunc('day', coalesce(p_to, now())) + interval '1 day';
  v_bas := greatest(date_trunc('day', coalesce(p_from, now() - interval '30 days')),
                    coalesce(v_m.joined_at, v_m.created_at));

  return jsonb_build_object(
    'ok', true,
    'uye', jsonb_build_object(
      'profil_id', v_m.profile_id,
      'ad',        coalesce(public.unquote_text(v_m.name),
                            (select p.name from public.profiles p where p.id = v_m.profile_id)),
      'rol',       v_m.role,
      'durum',     v_m.status,
      'katilim',   coalesce(v_m.joined_at, v_m.created_at)),
    'aralik', jsonb_build_object('bas', v_bas, 'bit', v_bit),
    'toplam', (
      select coalesce(jsonb_object_agg(t.event_type, t.n), '{}'::jsonb)
        from (select e.event_type, count(*) n
                from public.analytics_events e
               where e.profile_id = p_profile_id
                 and e.created_at >= v_bas and e.created_at < v_bit
               group by e.event_type) t),
    'kaynak', (
      select coalesce(jsonb_object_agg(coalesce(t.source, 'bilinmiyor'), t.n), '{}'::jsonb)
        from (select e.source, count(*) n
                from public.analytics_events e
               where e.profile_id = p_profile_id
                 and e.created_at >= v_bas and e.created_at < v_bit
                 and e.event_type in ('profile_view','qr_scan','nfc_tap')
               group by e.source) t),
    'gunluk', (
      select coalesce(jsonb_agg(jsonb_build_object('gun', t.gun, 'toplam', t.n) order by t.gun), '[]'::jsonb)
        from (select e.created_at::date gun, count(*) n
                from public.analytics_events e
               where e.profile_id = p_profile_id
                 and e.created_at >= v_bas and e.created_at < v_bit
               group by 1) t),
    'profiller', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ad', coalesce(x.display_name, x.name),
               'ana', x.is_primary,
               'goruntulenme', t.n) order by t.n desc), '[]'::jsonb)
        from (select e.persona_id, count(*) n
                from public.analytics_events e
               where e.profile_id = p_profile_id
                 and e.persona_id is not null
                 and e.created_at >= v_bas and e.created_at < v_bit
               group by 1) t
        join public.personas x on x.id = t.persona_id),
    'baglantilar', (
      select coalesce(jsonb_agg(jsonb_build_object('hedef', t.hedef, 'tiklama', t.n) order by t.n desc), '[]'::jsonb)
        from (select coalesce(e.metadata->>'label', e.metadata->>'platform', 'bilinmiyor') hedef, count(*) n
                from public.analytics_events e
               where e.profile_id = p_profile_id
                 and e.event_type = 'link_click'
                 and e.created_at >= v_bas and e.created_at < v_bit
               group by 1 limit 10) t)
  );
end;
$fn$;

revoke all on function public.org_member_detail(uuid,uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.org_member_detail(uuid,uuid,timestamptz,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Kurum listesi tek çağrıda (panel her kurum için ayrı sorgu atıyordu)
--    ve STK tipi kararı SUNUCUDA (arayüzdeki 4 elemanlı liste 'dernek'i
--    tanımıyordu, o kurumun başvuru ekranı hiç açılmıyordu).
-- ---------------------------------------------------------------------------

create or replace function public.my_organizations()
returns table (
  id uuid, name text, type text, logo_url text, theme_color text,
  my_role text, member_count int, is_stk boolean, is_admin boolean,
  pending_applications bigint, settings jsonb, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select o.id,
         public.unquote_text(o.name),
         public.unquote_text(o.type),
         o.logo_url,
         o.theme_color,
         m.role,
         (select count(*)::int from public.members m2 where m2.organization_id = o.id),
         public.is_stk_org_type(o.type),
         (m.role = 'admin'),
         case when m.role = 'admin'
              then (select count(*) from public.applications a
                     where a.organization_id = o.id and a.status = 'pending')
              else 0 end,
         coalesce(o.settings, '{}'::jsonb),
         o.created_at
    from public.members m
    join public.organizations o on o.id = m.organization_id
   where m.profile_id = public.my_profile_id()
   order by (m.role = 'admin') desc, o.name;
$fn$;

revoke all on function public.my_organizations() from public, anon;
grant execute on function public.my_organizations() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Üye listesinde iletişim bilgisi yalnızca yöneticide
--    (üyeler birbirinin e-posta/telefonunu ham tablodan okuyabiliyordu)
-- ---------------------------------------------------------------------------

create or replace function public.org_member_list(p_org_id uuid)
returns table (id uuid, profile_id uuid, name text, email text, phone text,
               role text, status text, joined_at timestamptz, avatar_url text,
               title text, company text, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $fn$
  select m.id, m.profile_id,
         coalesce(public.unquote_text(m.name), p.name),
         case when public.is_admin_of_org(p_org_id) or m.profile_id = public.my_profile_id()
              then public.unquote_text(m.email) end,
         case when public.is_admin_of_org(p_org_id) or m.profile_id = public.my_profile_id()
              then public.unquote_text(m.phone) end,
         m.role, m.status,
         coalesce(m.joined_at, m.created_at),
         p.avatar_url,
         case when exists (select 1 from public.profile_fields f
                            join public.personas x on x.id = f.persona_id
                            where f.profile_id = p.id and f.field_key = 'title'
                              and x.is_primary and f.visibility = 'public')
              then p.title end,
         case when exists (select 1 from public.profile_fields f
                            join public.personas x on x.id = f.persona_id
                            where f.profile_id = p.id and f.field_key = 'company'
                              and x.is_primary and f.visibility = 'public')
              then p.company end,
         (m.profile_id is not null and m.profile_id = public.my_profile_id())
    from public.members m
    left join public.profiles p on p.id = m.profile_id
   where m.organization_id = p_org_id
     and public.is_member_of_org(p_org_id)
   order by (m.role = 'admin') desc, m.name nulls last;
$fn$;

revoke all on function public.org_member_list(uuid) from public, anon;
grant execute on function public.org_member_list(uuid) to authenticated;
