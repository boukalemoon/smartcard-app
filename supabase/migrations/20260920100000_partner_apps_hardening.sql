-- ============================================================================
-- ORTAK VERİTABANINDAKİ UYGULAMALAR: TINGA, İLGEZDİ — sertleştirme
-- ============================================================================
--
-- Kaynak: İlgezdi oturumunun 19.09.2026 raporu ("QRtım — İlgezdi ve Arku için
-- öneriler") + QRtım oturumunun canlı veritabanı ve dağıtılmış fonksiyonlar
-- üzerinde yaptığı doğrulama (20.09.2026). Rapor QRtım kaynağını görmeden
-- yazılmıştı; maddeler tek tek canlıda kontrol edildi:
--
--   Madde 1 (email_verified)  → ZATEN VAR. partner-issue-token doğrulanmamış
--                               kullanıcıya belirteç vermiyor; arku-link /
--                               tinga-link 403 dönüyor ve email_verified:true
--                               ekliyor. Canlıda 10.09.2026'dan beri.
--   Madde 2 (60 sn belirteç)  → Yeni fonksiyon gerekmiyor: partner-issue-token
--                               zaten QRtım oturumuyla çağrılıyor. Süre
--                               parametresi, hız sınırı ve denetim kaydı
--                               eklendi (fonksiyon kodunda).
--   Madde 3 (plan sorgusu)    → Bu dosyada: ilgezdi_effective_plan().
--   O-03 (senkron çoğalması)  → ZATEN ÇÖZÜK. ilgezdi_sync_data'nın birincil
--                               anahtarı user_id; çift satır oluşamaz.
--   O-04 (profil satırı)      → Bu dosyada: plan korunuyor, ensure RPC eklendi.
--                               Tabloda 0 satır var: e-posta onayı açık
--                               olduğundan kayıt anında erişim belirteci yok,
--                               istemcinin yazması anon'a düşüp RLS'e takılıyor.
--   O-05 (QR ele geçirme)     → ilgezdi-qr fonksiyonunda + bu dosyadaki kolonlar.
--
-- Raporda OLMAYAN, doğrulamada bulunan:
--   • Tınga: tinga_listeler_acik görünümü anon'a YAZMA yetkisi veriyordu.
--     Görünüm sahibinin yetkisiyle çalıştığı için RLS atlanıyordu: giriş
--     yapmamış biri başkasının herkese açık listesini değiştirip SİLEBİLİYORDU
--     (geri alınan işlemde denendi: güncelleme 1 satır, silme 1 satır).

-- ---------------------------------------------------------------------------
-- 1) Tınga
-- ---------------------------------------------------------------------------

-- Görünüm yalnızca okumak için var (herkese açık listeler, sahip kimliği yok).
revoke insert, update, delete, truncate, references, trigger
  on public.tinga_listeler_acik from anon, authenticated;

-- search_path sabitlenmemiş fonksiyon (denetleyici uyarısı). Gövde zaten
-- public. önekli nesneler kullanıyor.
alter function public.tinga_zevk_yakinlik(uuid, uuid) set search_path = '';

-- ---------------------------------------------------------------------------
-- 2) İlgezdi tabloları: anon'un hiçbir işi yok
-- ---------------------------------------------------------------------------
-- RLS satırları zaten koruyordu (auth.uid() anon'da boş), ama anon'a bütün
-- tablo yetkileri (TRUNCATE dahil) verilmiş durumdaydı. Katmanlı savunma.
revoke all on public.ilgezdi_profiles, public.ilgezdi_sync_data, public.ilgezdi_qr_sessions from anon;
-- QR oturumlarına yalnızca ilgezdi-qr fonksiyonu (service_role) dokunur.
revoke all on public.ilgezdi_qr_sessions from authenticated;
revoke truncate, references, trigger on public.ilgezdi_profiles, public.ilgezdi_sync_data from authenticated;

-- ---------------------------------------------------------------------------
-- 3) QR girişi (O-05): istemci sırrı + isteği yapan cihaz etiketi
-- ---------------------------------------------------------------------------
-- QR'daki session_token aynı zamanda "status" sorgusunun tek sırrıydı: QR'ı
-- gören herkes (ekran paylaşımı, omuz üstü, fotoğraf) yoklama yapıp onaylanan
-- oturumu kapabiliyordu. Artık "create" QR'a girmeyen ayrı bir client_secret
-- döndürür; sunucu yalnızca özetini saklar.
-- requester_label: onay ekranında "bu istek hangi cihazdan geldi" gösterilir
-- (sahte QR ile oturum çalma — QRLjacking — karşı önlem).
alter table public.ilgezdi_qr_sessions
  add column if not exists client_secret_hash text,
  add column if not exists requester_label text;

comment on column public.ilgezdi_qr_sessions.client_secret_hash is
  'Tarayıcıda kalan istemci sırrının SHA-256 özeti. Boşsa eski istemci (geçiş dönemi).';

-- ---------------------------------------------------------------------------
-- 4) ilgezdi_profiles (O-04): plan ve e-posta istemciden yazılamaz
-- ---------------------------------------------------------------------------
-- Kullanıcı kendi satırında plan = 'enterprise' yazabiliyordu. İstemcide
-- plan buradan okunuyor; sunucu yetki kararı ondan verilmemeli
-- (bkz. ilgezdi_effective_plan). E-posta da istemciden serbestti ve tabloda
-- UNIQUE olduğu için başkasının e-postası "kapılabilirdi".
--
-- INVOKER bilerek: current_user kontrolü DEFINER altında her zaman sahibi
-- görür ve koruma hiç çalışmaz (organizations_protect_system_columns'ta
-- yaşanan hata).
create or replace function public.ilgezdi_profiles_protect()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare v_jwt_email text := nullif(auth.jwt() ->> 'email', '');
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.plan is distinct from 'free' then
        perform public.log_protected_write('ilgezdi_profile', coalesce(new.user_id::text, '?'), array['plan']);
      end if;
      new.plan := 'free';
      new.email := coalesce(v_jwt_email, new.email);
    else
      if new.plan is distinct from old.plan then
        perform public.log_protected_write('ilgezdi_profile', old.user_id::text, array['plan']);
        new.plan := old.plan;
      end if;
      new.user_id := old.user_id;
      new.email := coalesce(v_jwt_email, old.email);
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists ilgezdi_profiles_protect_trg on public.ilgezdi_profiles;
create trigger ilgezdi_profiles_protect_trg
  before insert or update on public.ilgezdi_profiles
  for each row execute function public.ilgezdi_profiles_protect();

-- İstemcinin kayıt anında yazması yerine: oturum alındıktan sonra çağrılır,
-- satır yoksa oluşturur, varsa son giriş zamanını günceller. E-posta
-- auth.users'tan gelir, plan hiç yazılmaz.
create or replace function public.ilgezdi_ensure_profile(p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_ad    text := left(nullif(btrim(coalesce(p_display_name, '')), ''), 80);
  v_row   public.ilgezdi_profiles;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  begin
    insert into public.ilgezdi_profiles as ip (user_id, email, display_name, last_login_at)
    values (v_uid, v_email, coalesce(v_ad, ''), now())
    on conflict (user_id) do update
       set last_login_at = now(),
           email         = excluded.email,
           display_name  = coalesce(v_ad, ip.display_name)
    returning * into v_row;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'hata', 'eposta_baska_hesapta');
  end;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_row.user_id,
    'email', v_row.email,
    'display_name', v_row.display_name,
    'created_at', v_row.created_at,
    'last_login_at', v_row.last_login_at);
end;
$fn$;

revoke all on function public.ilgezdi_ensure_profile(text) from public, anon;
grant execute on function public.ilgezdi_ensure_profile(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Plan sorgusu (madde 3): yalnızca kendi hesabı, kaynak QRtım aboneliği
-- ---------------------------------------------------------------------------
-- Senkron hakları plan_features tablosunda VERİ olarak durur.
-- Burak'ın kararı (19.09): ücretsiz katman tek cihaz, şifreler hariç.
-- Ücretli katmanların değerleri fiyat/paket revizyonunda kesinleşecek; şimdilik
-- yer tutucu. Değiştirmek migration gerektirmez.
alter table public.plan_features
  add column if not exists sync_max_devices int,
  add column if not exists sync_passwords boolean;

update public.plan_features
   set sync_max_devices = case plan when 'free' then 1 when 'student' then 2
                                    when 'professional' then 5 when 'stk' then 5
                                    when 'business' then 10 when 'corporate' then 10
                                    else 1 end,
       sync_passwords   = (plan <> 'free')
 where sync_max_devices is null;

comment on column public.plan_features.sync_max_devices is
  'Senkron cihaz sınırı. Ücretsiz=1 (Burak kararı 19.09.2026); ücretli katmanlar fiyat revizyonunda kesinleşecek.';
comment on column public.plan_features.sync_passwords is
  'Şifre senkronu hakkı. Ücretsizde yok (Burak kararı 19.09.2026).';

-- Parametre ALMAZ: başka kullanıcının planı sorgulanamaz (Arku'da O3 olarak
-- düzeltilen hatanın tekrarlanmaması için). Plan ilgezdi_profiles.plan'dan
-- değil, QRtım aboneliğinden gelir; süresi dolmuş abonelik ücretsiz sayılır.
create or replace function public.ilgezdi_effective_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v_plan text; v_bitis timestamptz; v_pf public.plan_features;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  select s.plan, s.expires_at into v_plan, v_bitis
    from public.subscriptions s
   where s.profile_id = public.my_profile_id()
     and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc
   limit 1;

  v_plan := coalesce(v_plan, 'free');
  select * into v_pf from public.plan_features where plan = v_plan;

  return jsonb_build_object(
    'ok', true,
    'plan', v_plan,
    'expires_at', v_bitis,
    'max_sync_devices', coalesce(v_pf.sync_max_devices, 1),
    'password_sync', coalesce(v_pf.sync_passwords, false));
end;
$fn$;

revoke all on function public.ilgezdi_effective_plan() from public, anon;
grant execute on function public.ilgezdi_effective_plan() to authenticated;
