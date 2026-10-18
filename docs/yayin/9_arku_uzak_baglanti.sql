-- ============================================================================
-- Arku uzak masaüstü: paylaşılabilir bağlantı kimliği ve bağlantı süreleri
-- ============================================================================
--
-- KAPSAM (Burak, 18.10.2026): "Arku hesabında oluşturulan kullanıcı hesabına
-- özel bir ID tanımlanacak. Bu ID'yi uzak masaüstü bağlantısı yapmak için
-- QRtım hesabından da paylaşabileceği bir ID olması gerekiyor... bağlandığı
-- sürenin bilgisini alabilecek bir yapı kurmak. Başka bir özellik almayacağız."
-- Bu dosya tam bu ikisini yapar: kimlik + süre. Arku'nun kendi abonelik
-- sistemi var, plan/ücret tarafına girilmiyor.
--
-- qrtim_uid KULLANILMIYOR — bilinçli. Kimlik.jsx'te şu karar duruyor:
-- "Kopyalama/paylaşım caydırılır: kimlik bilgi amaçlı, paylaşılacak bir şey
-- değil." qrtim_uid bağlı uygulamaların kullanıcıyı tanıdığı kimlik;
-- paylaşılabilir hâle gelmesi kimlik sızdırma yolu açardı. Arku'nun bağlantı
-- kimliği AYRI bir değer: paylaşılmak ÜZERE üretilir, Arku üretir.
--
-- Kimliğin yeri partner_user_links: satır zaten kullanıcı+partner başına var,
-- RLS açık ve HİÇ politikası yok (yalnız service_role erişir). Kimliği
-- user_sync_data'ya koymak yanlış olurdu: oraya kullanıcı kendi satırını
-- yazabiliyor, yani kendi Arku kimliğini uydurabilirdi.

-- ---------------------------------------------------------------------------
-- 1) Bağlantı kimliği
-- ---------------------------------------------------------------------------
alter table public.partner_user_links
  add column if not exists remote_id text;

alter table public.partner_user_links
  drop constraint if exists partner_user_links_remote_id_chk;
alter table public.partner_user_links
  add constraint partner_user_links_remote_id_chk
  check (remote_id is null or remote_id ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{2,63}$');

comment on column public.partner_user_links.remote_id is
  'Partnerin urettigi, PAYLASILMAK uzere olan baglanti kimligi (Arku uzak masaustu). qrtim_uid ile karistirilmamali: o paylasilmaz.';

-- ---------------------------------------------------------------------------
-- 2) Bağlantı oturumları
-- ---------------------------------------------------------------------------
create table if not exists public.partner_remote_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  partner      text not null references public.integration_providers(key) on delete cascade,
  -- Partnerin kendi oturum kimliği: aynı oturum iki kez bildirilirse
  -- ikinci bildirim yeni satır açmaz, mevcut satırı kapatır.
  session_ref  text not null,
  started_at   timestamptz not null,
  ended_at     timestamptz,
  -- Kapanışta hesaplanır. Açık oturumda null kalır: tahmin yazılmaz.
  duration_seconds integer,
  created_at   timestamptz not null default now(),
  unique (partner, session_ref),
  constraint partner_remote_sessions_sure_chk
    check (ended_at is null or ended_at >= started_at),
  constraint partner_remote_sessions_ref_chk
    check (session_ref ~ '^[A-Za-z0-9._:-]{4,128}$')
);

create index if not exists partner_remote_sessions_kullanici_idx
  on public.partner_remote_sessions (user_id, started_at desc);

alter table public.partner_remote_sessions enable row level security;

-- Kullanıcı YALNIZ kendi oturumlarını OKUR. Yazma politikası YOK: yalnız
-- service_role (Edge Function) yazar. İstemci kendi süresini uyduramaz.
drop policy if exists "kendi uzak oturumlarini okur" on public.partner_remote_sessions;
create policy "kendi uzak oturumlarini okur"
  on public.partner_remote_sessions for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.partner_remote_sessions from anon, authenticated;
grant select on public.partner_remote_sessions to authenticated;

comment on table public.partner_remote_sessions is
  'Partner uygulamasindaki uzak baglanti oturumlari (sure bilgisi). Yalniz service_role yazar; kullanici kendi satirlarini okur.';

-- ---------------------------------------------------------------------------
-- 3) Partnerin bildirimi (sunucudan sunucuya)
-- ---------------------------------------------------------------------------
-- Edge Function link_secret'i doğruladıktan sonra service_role ile çağırır.
-- Parametre olarak kullanıcı ALMAZ: kullanıcı link_secret'ten çözülür, böylece
-- partner başkasının adına oturum bildiremez (Arku'da O3 olarak düzeltilen
-- hatanın tekrarlanmaması için — bkz. partner_effective_plan).
create or replace function public.partner_remote_session_report(
  p_partner      text,
  p_qrtim_uid    text,
  p_link_secret  text,
  p_session_ref  text,
  p_started_at   timestamptz,
  p_ended_at     timestamptz default null,
  p_remote_id    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_sure integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;

  if p_partner is null or p_partner !~ '^[a-z0-9_-]{2,32}$'
     or p_qrtim_uid is null
     or p_qrtim_uid !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_link_secret is null or p_link_secret !~ '^[0-9a-f]{64}$'
     or p_session_ref is null or p_session_ref !~ '^[A-Za-z0-9._:-]{4,128}$'
     or p_started_at is null then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_istek');
  end if;

  -- Kullanıcı yalnız (partner + qrtim_uid + link_secret) üçlüsünden çözülür.
  select l.user_id into v_user
    from public.partner_user_links l
    join public.qrtim_user_ids q on q.user_id = l.user_id
   where l.partner = p_partner
     and q.qrtim_uid = p_qrtim_uid::uuid
     and l.link_secret = p_link_secret;

  if v_user is null then
    return jsonb_build_object('ok', false, 'hata', 'baglanti_yok');
  end if;

  -- Gelecekte başlayan ya da aşırı uzun oturum kabul edilmez: partner
  -- tarafındaki saat hatası veriyi bozmasın.
  if p_started_at > now() + interval '5 minutes'
     or p_started_at < now() - interval '90 days' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_zaman');
  end if;

  if p_ended_at is not null then
    if p_ended_at < p_started_at or p_ended_at > now() + interval '5 minutes' then
      return jsonb_build_object('ok', false, 'hata', 'gecersiz_zaman');
    end if;
    v_sure := floor(extract(epoch from (p_ended_at - p_started_at)))::int;
  end if;

  insert into public.partner_remote_sessions
    (user_id, partner, session_ref, started_at, ended_at, duration_seconds)
  values (v_user, p_partner, p_session_ref, p_started_at, p_ended_at, v_sure)
  on conflict (partner, session_ref) do update
    set ended_at = coalesce(excluded.ended_at, public.partner_remote_sessions.ended_at),
        duration_seconds = coalesce(excluded.duration_seconds, public.partner_remote_sessions.duration_seconds);

  -- Bağlantı kimliği de bu çağrıda tazelenebilir (Arku yeniler ya da ilk kez bildirir).
  if p_remote_id is not null then
    update public.partner_user_links
       set remote_id = p_remote_id, last_seen = now()
     where partner = p_partner and user_id = v_user;
  else
    update public.partner_user_links
       set last_seen = now()
     where partner = p_partner and user_id = v_user;
  end if;

  return jsonb_build_object('ok', true, 'sure_sn', v_sure);
end;
$$;

revoke all on function public.partner_remote_session_report(text,text,text,text,timestamptz,timestamptz,text)
  from public, anon, authenticated;

comment on function public.partner_remote_session_report(text,text,text,text,timestamptz,timestamptz,text) is
  'Partner uzak baglanti oturumu bildirir. Yalniz service_role. Kullanici link_secret ten cozulur, parametreyle alinmaz.';

-- ---------------------------------------------------------------------------
-- 4) Panelin okuduğu özet
-- ---------------------------------------------------------------------------
create or replace function public.my_remote_baglanti(p_partner text default 'arku')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kimlik text;
  v_ozet   jsonb;
  v_son    jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;
  if p_partner is null or p_partner !~ '^[a-z0-9_-]{2,32}$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_istek');
  end if;

  select l.remote_id into v_kimlik
    from public.partner_user_links l
   where l.user_id = auth.uid() and l.partner = p_partner;

  select jsonb_build_object(
           'oturum_sayisi', count(*),
           'toplam_sure_sn', coalesce(sum(duration_seconds), 0),
           'suren_oturum', count(*) filter (where ended_at is null)
         )
    into v_ozet
    from public.partner_remote_sessions s
   where s.user_id = auth.uid() and s.partner = p_partner;

  select coalesce(jsonb_agg(jsonb_build_object(
           'baslangic', started_at, 'bitis', ended_at, 'sure_sn', duration_seconds
         ) order by started_at desc), '[]'::jsonb)
    into v_son
    from (
      select started_at, ended_at, duration_seconds
        from public.partner_remote_sessions
       where user_id = auth.uid() and partner = p_partner
       order by started_at desc
       limit 20
    ) x;

  return jsonb_build_object(
    'ok', true,
    'baglanti_kimligi', v_kimlik,   -- null ise partner henüz bildirmedi
    'ozet', coalesce(v_ozet, jsonb_build_object('oturum_sayisi', 0, 'toplam_sure_sn', 0, 'suren_oturum', 0)),
    'son_oturumlar', v_son
  );
end;
$$;

revoke all on function public.my_remote_baglanti(text) from public, anon;
grant execute on function public.my_remote_baglanti(text) to authenticated;

comment on function public.my_remote_baglanti(text) is
  'Kisinin kendi uzak baglanti kimligi ve son 20 oturumunun suresi.';

-- ---------------------------------------------------------------------------
-- 5) Saklama
-- ---------------------------------------------------------------------------
-- retention_days BİLEREK null ve confirmed false: tablodaki diğer satırların
-- hepsi öyle. Süreyi ve hukuki dayanağı kurucu belirler; null olduğu sürece
-- aşağıdaki temizlik HİÇBİR ŞEY SİLMEZ (prune_audit_log ile aynı davranış).
insert into public.data_retention_policies (key, description, action_patterns, retention_days, confirmed)
values ('uzak_baglanti_oturumlari',
        'Partner uygulamasindaki uzak masaustu baglanti oturumlarinin baslangic/bitis ve sure kaydi.',
        array['partner.remote_session%'], null, false)
on conflict (key) do nothing;

create or replace function public.prune_remote_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_gun int; v_n int := 0;
begin
  select retention_days into v_gun
    from public.data_retention_policies where key = 'uzak_baglanti_oturumlari';

  if v_gun is null then
    return 0;   -- sure belirlenmemis: silme yok
  end if;

  delete from public.partner_remote_sessions
   where started_at < now() - make_interval(days => v_gun);
  get diagnostics v_n = row_count;

  if v_n > 0 then
    perform public.log_event('partner.remote_session_prune', null, 'qrtim',
      'partner_remote_sessions', null, 'success', 'notice', 'internal',
      jsonb_build_object('silinen', v_n), 'system');
  end if;
  return v_n;
end;
$$;

revoke all on function public.prune_remote_sessions() from public, anon, authenticated;

select cron.schedule('qrtim-uzak-oturum-saklama', '53 3 * * 0',
                     'select public.prune_remote_sessions()')
 where not exists (select 1 from cron.job where jobname = 'qrtim-uzak-oturum-saklama');

-- ---------------------------------------------------------------------------
-- 6) Yetki temizliği — partner_user_links
-- ---------------------------------------------------------------------------
-- Tabloda link_secret duruyor (partner kimlik taşıyıcısı). RLS açık ve hiç
-- politikası yok, yani okuma/yazma kapalı; ama anon ve authenticated'da
-- tablo düzeyi INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER yetkileri
-- duruyordu. TRUNCATE RLS'i DELMEZ: bu yetkilerin kalması gereksiz risk.
revoke all on public.partner_user_links from anon, authenticated;
