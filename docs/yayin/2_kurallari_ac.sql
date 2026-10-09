-- ============================================================================
-- YAYIN PAKETİ 2/2 — Kuralları açar (IBAN, MFA kapısı, kurtarma, kovalar, QR)
-- ============================================================================
-- ÖNKOŞUL: shieldauth Edge Function yayında VE yeni web sürümü canlıda.
-- Aksi halde TOTP kullanıcıları doğrulama ekranında döngüye girer.
-- Tamamı tek işlemde çalışır: bir adım hata verirse HİÇBİRİ uygulanmaz.
-- Kaynaklar (sırayla, birebir):
--   20260929091000_shieldauth_odeme_tetikleyici.sql
--   20261008100000_mfa_yontem_ve_kimlik_yazma.sql
--   20261008101000_kurtarma_anon_kapat.sql
--   20261008102000_depolama_ve_olay_sinirlari.sql
--   20261008103000_qr_sayi_eslestirme.sql
begin;

-- Önkoşul denetimi: paketin dayandığı nesneler canlıda yoksa dur.
do $on$
declare eksik text[] := '{}'; f text;
begin
  if to_regclass('public.shieldauth_mfa_assertions') is null then eksik := eksik || 'shieldauth tablolari (paket 1)'::text; end if;
  if to_regclass('public.profile_payment') is null then eksik := eksik || 'profile_payment'::text; end if;
  if to_regclass('public.ilgezdi_qr_sessions') is null then eksik := eksik || 'ilgezdi_qr_sessions'::text; end if;
  foreach f in array array[
    'recovery_start(text,text,text,text,text)','recovery_cancel(text,boolean)',
    'recovery_contact_invite(text)','recovery_contact_respond(uuid,boolean)',
    'recovery_contact_revoke(uuid)','recovery_approve_as_contact(uuid)',
    'recovery_approve_from_session(uuid)','recovery_complete(uuid)',
    'recovery_pending_for_me()','recovery_wait_interval(text,boolean)'
  ] loop
    if to_regprocedure('public.' || f) is null then eksik := eksik || f; end if;
  end loop;
  if array_length(eksik, 1) > 0 then
    raise exception 'Önkoşul eksik, hiçbir şey uygulanmadı: %', array_to_string(eksik, ', ');
  end if;
end
$on$;

-- >>>>>>>>>> 20260929091000_shieldauth_odeme_tetikleyici.sql
-- ============================================================================
-- ShieldAuth — IBAN / fatura kuralını AÇAN adım
-- ============================================================================
--
-- 20260929090000_shieldauth_mfa.sql tabloları, kontrol fonksiyonlarını ve
-- guard_profile_payment_mfa() gövdesini kurar ama hiçbir yere bağlamaz.
-- Kuralı fiilen yürürlüğe sokan tek satır burada.
--
-- BU DOSYA EN SON UYGULANIR — şu ikisi CANLIDA çalışır durumdayken:
--   • shieldauth Edge Function + SHIELDAUTH_* secret'ları
--   • adım atlama penceresini gösteren web sürümü
-- Aksi halde kişi IBAN'ını değiştiremez ama doğrulama da yapamaz: kilitlenir.
--
-- Uygulamadan önce kontrol (üçü de true olmalı):
--   select
--     to_regprocedure('public.shieldauth_mfa_fresh(interval)') is not null as fonksiyon_var,
--     to_regclass('public.shieldauth_mfa_assertions') is not null          as tablo_var,
--     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--             where n.nspname = 'public' and p.proname = 'guard_profile_payment_mfa') as govde_var;
--
-- Acil geri alma (kuralı kaldırır, tablolar kalır):
--   drop trigger trg_guard_profile_payment_mfa on public.profile_payment;

drop trigger if exists trg_guard_profile_payment_mfa on public.profile_payment;
create trigger trg_guard_profile_payment_mfa
  before insert or update on public.profile_payment
  for each row execute function public.guard_profile_payment_mfa();

comment on trigger trg_guard_profile_payment_mfa on public.profile_payment is
  'ShieldAuth: IBAN/fatura değişikliği son 10 dakikada iki adımlı doğrulama ister. Geri alma: bu trigger düşürülür.';

-- >>>>>>>>>> 20261008100000_mfa_yontem_ve_kimlik_yazma.sql
-- ============================================================================
-- İKİ ADIMLI DOĞRULAMA: YÖNTEM ŞARTI VE KİMLİK VERİSİNE YAZMA KAPISI
-- ============================================================================
--
-- Denetim bulguları G-02 ve G-01 (08.10.2026).
--
-- G-02 — E-POSTA KODU, DOĞRULAMA UYGULAMASININ YERİNE GEÇİYORDU
--   shieldauth_mfa_fresh() doğrulamanın YÖNTEMİNE bakmıyordu. Doğrulama
--   uygulaması (TOTP) kurmuş bir kişide e-postasına gelen kod da "taze iki
--   adımlı doğrulama" sayılıyordu. Hesap ele geçirmenin en yaygın yolu e-posta
--   hesabının düşmesidir; o durumda e-posta kodu hem birinci hem ikinci
--   faktörü karşılıyor ve TOTP'nin varlık sebebi ortadan kalkıyordu.
--
--   Kural: TOTP kurmuş kişide yalnızca 'totp' ve 'backup_code' sayılır.
--   TOTP kurmamış kişi için değişiklik yok (e-posta kodu geçerli; kimse
--   kilitlenmez). Bu fonksiyonu kullanan her yer — is_admin(), IBAN/fatura
--   tetikleyicisi, panel kapısı (shieldauth_mfa_durumum) ve aşağıdaki yeni
--   kapı — tek noktadan düzelir.
--
--   Kilitlenen kişi (telefonu ve yedek kodları kayıp): service_role ile
--   shieldauth_mfa_users.totp_enrolled = false yapılır ve ShieldAuth'ta TOTP
--   sıfırlanır. Bu destek işlemidir, kimlik doğrulanmadan yapılmaz.
--
-- G-01 — İKİ ADIMLI DOĞRULAMA YALNIZCA ARAYÜZDEYDİ
--   Parola doğrulandığı anda tam yetkili oturum açılıyor. Panel kapısı
--   (MfaKapisi) bir ekran; aynı belirteçle doğrudan /rest/v1 isteği atan biri
--   profili, bağlantıları, personaları ve kurum kayıtlarını değiştirebiliyordu.
--
--   Kural: TOTP kurmuş kişinin kimlik tablolarına yazabilmesi için bu oturumda
--   son 12 saatte TOTP/yedek kod doğrulaması olmalı (panel kapısıyla aynı
--   pencere). Tablo politikalarından BAĞIMSIZ, tetikleyiciyle uygulanır:
--   çekirdek tabloların politikaları depoda değil (bkz. denetim O-12), adlarını
--   bilmeden değiştirmek yerine her yazmanın önüne kapı konuyor.
--
--   Kimin isteği? current_user'a değil JWT'deki role bakılır. Böylece
--   SECURITY DEFINER RPC'ler (persona_update, appointment_settings_save, ...)
--   içinden yapılan yazmalar da korunur. service_role, doğrudan veritabanı
--   bağlantıları ve GoTrue tetikleyicileri (kayıt) JWT taşımadığı için muaftır.
--
--   Sayaç istisnası: kartı açan GİRİŞLİ bir ziyaretçi track_card_event ile
--   başkasının profilindeki görüntülenme sayacını artırır. O yazma ziyaretçinin
--   doğrulama durumuna takılmamalı. Bu yüzden tetikleyiciye "yalnızca bu
--   sütunlar değiştiyse geçir" listesi verilir (tetikleyici argümanları).

-- ---------------------------------------------------------------------------
-- G-02: yöntem farkında tazelik
-- ---------------------------------------------------------------------------
create or replace function public.shieldauth_mfa_fresh(max_age interval default interval '10 minutes')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shieldauth_mfa_assertions a
    where a.user_id = auth.uid()
      and a.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and a.verified_at > now() - max_age
      and (
        a.method in ('totp', 'backup_code')
        or not public.shieldauth_mfa_enrolled(auth.uid())
      )
  );
$$;

revoke all on function public.shieldauth_mfa_fresh(interval) from public, anon;
grant execute on function public.shieldauth_mfa_fresh(interval) to authenticated;

comment on function public.shieldauth_mfa_fresh(interval) is
  'Bu oturum son max_age içinde doğrulandı mı? TOTP kurmuş kişide yalnızca totp/backup_code sayılır (denetim G-02).';

-- ---------------------------------------------------------------------------
-- G-01: kimlik tablolarına yazma kapısı
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: shieldauth_mfa_enrolled() istemci rolüne kapalı; kapı onu
-- çağırabilmeli. Muafiyet kararı current_user'a DEĞİL JWT rolüne dayandığı
-- için definer olması muafiyeti bozmaz.
create or replace function public.guard_identity_write_mfa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol   text := coalesce(auth.jwt() ->> 'role', '');
  v_uid   uuid := auth.uid();
  v_gecer boolean := false;
begin
  if v_rol <> 'authenticated' or v_uid is null then
    v_gecer := true;
  elsif not public.shieldauth_mfa_enrolled(v_uid) then
    v_gecer := true;
  elsif public.shieldauth_mfa_fresh(interval '12 hours') then
    v_gecer := true;
  elsif tg_op = 'UPDATE' and tg_nargs > 0 then
    -- Yalnızca sayaç/zaman sütunları değiştiyse (ör. başkasının kartını açan
    -- girişli ziyaretçi) geçir. Liste tetikleyici argümanıdır.
    --
    -- Değişen sütunlar tek tek bulunur ve HEPSİ listede olmalı. Saklanan
    -- üretilmiş sütunlar (GENERATED ALWAYS ... STORED) BEFORE tetikleyicide
    -- NEW'de boş görünür; "değişti" sayılıp istisnayı bozmasınlar diye
    -- karşılaştırmaya alınmaz.
    select coalesce(bool_and(k = any (tg_argv)), true)
      into v_gecer
      from jsonb_object_keys(to_jsonb(new)) as k
     where (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k)
       and k not in (
         select a.attname::text
           from pg_catalog.pg_attribute a
          where a.attrelid = tg_relid
            and a.attgenerated <> ''
       );
  end if;

  if v_gecer then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'mfa_required'
    using errcode = '42501',
          hint = 'Bu değişiklik için iki adımlı doğrulama gerekiyor.';
end;
$$;

revoke all on function public.guard_identity_write_mfa() from public, anon, authenticated;

comment on function public.guard_identity_write_mfa() is
  'Denetim G-01: TOTP kurmuş kişinin kimlik tablolarına yazması için oturumda son 12 saatte TOTP/yedek kod doğrulaması şart. JWT rolü authenticated olmayan istekler muaf.';

-- Tetikleyiciler. Ad "zz_" ile başlar: BEFORE tetikleyicileri ada göre sırayla
-- çalışır; kapı en son çalışıp diğer tetikleyicilerin düzelttiği NEW'i görür.
-- Var olmayan tablo atlanır (ortamlar arası fark varsa migration düşmesin).
do $mig$
declare
  r record;
begin
  for r in
    select * from (values
      ('profiles',            array['card_views','last_viewed_at','updated_at']),
      ('personas',            array['view_count','last_viewed_at','updated_at']),
      ('persona_social_links', array['updated_at']),
      ('social_links',        array['updated_at']),
      ('profile_fields',      array['updated_at']),
      ('custom_domains',      array['updated_at']),
      ('organizations',       array['member_count','updated_at']),
      ('members',             array['updated_at']),
      ('appointment_settings', array['updated_at'])
    ) as t(tablo, haric)
  loop
    if to_regclass('public.' || r.tablo) is null then
      -- Çekirdek tablo yoksa kapı sessizce yarım kalmasın: migration düşsün.
      if r.tablo in ('profiles', 'personas', 'social_links', 'organizations', 'members') then
        raise exception 'kimlik yazma kapisi: cekirdek tablo % yok', r.tablo;
      end if;
      raise notice 'kimlik yazma kapisi: % tablosu yok, atlandi', r.tablo;
      continue;
    end if;
    execute format('drop trigger if exists zz_mfa_kimlik_yazma_trg on public.%I', r.tablo);
    execute format(
      'create trigger zz_mfa_kimlik_yazma_trg before insert or update or delete on public.%I '
      'for each row execute function public.guard_identity_write_mfa(%s)',
      r.tablo,
      (select string_agg(quote_literal(x), ', ') from unnest(r.haric) as x)
    );
  end loop;
end
$mig$;

-- ---------------------------------------------------------------------------
-- Güçlü doğrulama zayıfıyla EZİLMESİN
-- ---------------------------------------------------------------------------
-- shieldauth Edge Function her doğrulamada (user_id, session_id) satırını
-- günceller (upsert). TOTP ile doğrulamış bir oturumda sonradan e-posta koduyla
-- doğrulama yapılırsa yöntem 'email' olur ve oturum "taze değil" sayılırdı:
-- kişi panelin ortasında kapıya geri düşer. Taze (12 saat) bir TOTP/yedek kod
-- kaydı, zayıf bir yöntemle değiştirilmez.
create or replace function public.shieldauth_mfa_assertions_dusurme()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.method in ('totp', 'backup_code')
     and old.verified_at > now() - interval '12 hours'
     and new.method not in ('totp', 'backup_code') then
    new.method      := old.method;
    new.verified_at := old.verified_at;
  end if;
  return new;
end;
$$;

revoke all on function public.shieldauth_mfa_assertions_dusurme() from public, anon, authenticated;

drop trigger if exists shieldauth_mfa_assertions_dusurme_trg on public.shieldauth_mfa_assertions;
create trigger shieldauth_mfa_assertions_dusurme_trg
  before update on public.shieldauth_mfa_assertions
  for each row execute function public.shieldauth_mfa_assertions_dusurme();

-- ---------------------------------------------------------------------------
-- IBAN/fatura tetikleyicisi: muafiyet de JWT rolüne bakar
-- ---------------------------------------------------------------------------
-- Eski sürüm current_user'a bakıyordu; SECURITY DEFINER bir fonksiyon
-- profile_payment'a yazarsa current_user sahibi (postgres) olur ve kapı
-- atlanırdı. Kimlik yazma kapısıyla aynı kural: JWT rolü authenticated ise
-- kural işler.
create or replace function public.guard_profile_payment_mfa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  degisti boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    degisti := coalesce(to_jsonb(new.bank_accounts), '[]'::jsonb) not in ('[]'::jsonb, '{}'::jsonb, 'null'::jsonb)
               or coalesce(to_jsonb(new.billing_info), 'null'::jsonb) not in ('null'::jsonb, '{}'::jsonb);
  else
    degisti := new.bank_accounts is distinct from old.bank_accounts
               or new.billing_info is distinct from old.billing_info;
  end if;

  if degisti and not public.shieldauth_mfa_fresh(interval '10 minutes') then
    raise exception 'mfa_required'
      using errcode = '42501',
            hint = 'Banka ve fatura bilgisini değiştirmek için iki adımlı doğrulama gerekiyor.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Görseller: profil fotoğrafı, arka plan ve logo dosyaları
-- ---------------------------------------------------------------------------
-- Görsel dosyası profil tablosundan bağımsız değiştirilebilir (aynı yola yeni
-- içerik). TOTP kurmuş kişide bu da 12 saatlik doğrulamayı ister. Mevcut
-- izin veren politikalara RESTRICTIVE olarak eklenir (VE ile bağlanır).
create or replace function public.mfa_yazma_serbest()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null
      or not public.shieldauth_mfa_enrolled(auth.uid())
      or public.shieldauth_mfa_fresh(interval '12 hours');
$$;

revoke all on function public.mfa_yazma_serbest() from public, anon;
grant execute on function public.mfa_yazma_serbest() to authenticated;

do $mig$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects yok, gorsel kapisi atlandi';
    return;
  end if;
  drop policy if exists "gorsel yazma mfa ister (ekle)" on storage.objects;
  drop policy if exists "gorsel yazma mfa ister (guncelle)" on storage.objects;
  drop policy if exists "gorsel yazma mfa ister (sil)" on storage.objects;
  create policy "gorsel yazma mfa ister (ekle)" on storage.objects
    as restrictive for insert to authenticated
    with check (bucket_id not in ('avatars', 'backgrounds', 'logos') or public.mfa_yazma_serbest());
  create policy "gorsel yazma mfa ister (guncelle)" on storage.objects
    as restrictive for update to authenticated
    using (bucket_id not in ('avatars', 'backgrounds', 'logos') or public.mfa_yazma_serbest())
    with check (bucket_id not in ('avatars', 'backgrounds', 'logos') or public.mfa_yazma_serbest());
  create policy "gorsel yazma mfa ister (sil)" on storage.objects
    as restrictive for delete to authenticated
    using (bucket_id not in ('avatars', 'backgrounds', 'logos') or public.mfa_yazma_serbest());
end
$mig$;

-- Geri alma (acil durum):
--   do $$ declare t text; begin
--     foreach t in array array['profiles','personas','persona_social_links','social_links',
--       'profile_fields','custom_domains','organizations','members','appointment_settings']
--     loop execute format('drop trigger if exists zz_mfa_kimlik_yazma_trg on public.%I', t); end loop;
--   end $$;

-- >>>>>>>>>> 20261008101000_kurtarma_anon_kapat.sql
-- ============================================================================
-- HESAP KURTARMA: ANONİM ERİŞİM KAPATILDI
-- ============================================================================
--
-- Denetim bulgusu G-05 (08.10.2026).
--
-- recovery_start ve recovery_cancel anonime açıktı. Sistemin arayüzü yok,
-- notification_outbox'ı okuyan bir gönderici de yok. Yani yarım bir sistem
-- dışarıya açıktı ve:
--
--   • HESAP VARLIĞI SIZIYORDU. Yorum "var olmayan e-posta aynı cevabı alır"
--     diyordu, ama kayıtlı e-postada { talep_id, bekleme_saniye, acilabilir },
--     ikinci denemede { hata: 'zaten_acik_talep_var' } dönüyordu; kayıtsız
--     e-postada yalnızca { bilgi: 'talep_alindi' }. Herkes bir adresin
--     QRtım'de olup olmadığını sorgulayabiliyordu.
--   • KURBANIN KURTARMASI KİLİTLENEBİLİYORDU. Kişi başına tek açık talep var;
--     hız sınırı yok. Saldırgan sürekli açık talep tutabiliyordu.
--   • ÇAĞIRANIN YAZDIĞI DEĞERLER GÜVENİLİYORDU. p_ip, p_user_agent ve
--     p_device_hash "tanıdık cihaz" indirimine ve kurbana giden bildirime
--     giriyordu.
--   • ASIL SAVUNMA ÇALIŞMIYORDU. "Kurban bildirim alır, tek tıkla iptal eder"
--     adımı için e-posta gönderen bir süreç yok.
--
--   • Kurtarma kişisi daveti (girişli kullanıcıya açık) da aynı sızıntıyı
--     taşıyordu (aşağıya bak).
--
-- Parolasını unutan kullanıcı artık standart Supabase parola sıfırlama
-- akışını kullanır (giriş ekranında "Şifremi unuttum", /sifre-yenile).
--
-- Kurtarma sistemi tamamlanınca yeniden açılırken (outbox göndericisi + arayüz):
--   1. Cevap her durumda AYNI olmalı (talep kimliği döndürülmez; e-postaya gider).
--   2. IP sunucuda okunmalı: public.request_client_ip(). p_ip/p_user_agent/
--      p_device_hash parametreleri kaldırılmalı.
--   3. E-posta ve IP başına hız sınırı (check_rate_limit).
--   4. Ancak ondan sonra: grant execute ... to anon.

-- Sistemin TAMAMI şimdilik istemciye kapalı. recovery_contact_invite de
-- (girişli her kullanıcıya açıktı, kayıt herkese açık) "qrtim_kullanicisi_degil"
-- ile "ok" cevabını ayırarak bir e-postanın kayıtlı olup olmadığını söylüyor ve
-- sınırsız davet satırı yazdırıyordu. Arayüz kullanmıyor; kapatmak bir şey
-- bozmaz. service_role (gelecekteki gönderici/zamanlayıcı) etkilenmez.
revoke all on function public.recovery_start(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.recovery_cancel(text, boolean)              from public, anon, authenticated;
revoke all on function public.recovery_contact_invite(text)               from public, anon, authenticated;
revoke all on function public.recovery_contact_respond(uuid, boolean)     from public, anon, authenticated;
revoke all on function public.recovery_contact_revoke(uuid)               from public, anon, authenticated;
revoke all on function public.recovery_approve_as_contact(uuid)           from public, anon, authenticated;
revoke all on function public.recovery_approve_from_session(uuid)         from public, anon, authenticated;
revoke all on function public.recovery_complete(uuid)                     from public, anon, authenticated;
revoke all on function public.recovery_pending_for_me()                   from public, anon, authenticated;
revoke all on function public.recovery_wait_interval(text, boolean)       from public, anon, authenticated;

comment on function public.recovery_start(text, text, text, text, text) is
  'Kurtarma talebi. Denetim G-05: istemciye KAPALI (hesap varlığı sızdırıyordu). Yeniden açma şartları migration 20261008101000 başlığında.';

-- >>>>>>>>>> 20261008102000_depolama_ve_olay_sinirlari.sql
-- ============================================================================
-- DEPOLAMA KOVASI SINIRLARI VE ANONİM OLAY GÖVDESİ TAVANI
-- ============================================================================
--
-- Denetim bulguları O-10 ve D-14 (08.10.2026).
--
-- O-10 — YÜKLEME DENETİMİ YALNIZCA İSTEMCİDEYDİ
--   ImageUpload.jsx dosya türünü ve boyutunu tarayıcıda kontrol ediyor; bu
--   kontrolü atlayan biri herkese açık kovalara (avatars, backgrounds, logos)
--   istediği dosyayı yükleyebiliyordu: SVG/HTML (kova alan adında betik),
--   çalıştırılabilir dosya, sınırsız boyut. Kural kovanın kendisine konuyor.
--   SVG BİLEREK dışarıda: içinde betik taşıyabilir.
--   Boyut: arayüzdeki en büyük sınır (arka plan 5 MB) ile aynı.
--
-- D-14 — ANONİM OLAY GÖVDESİ SINIRSIZDI
--   track_card_event anonime açık ve p_meta'yı (yalnızca ip/email/phone
--   anahtarlarını silerek) olduğu gibi analytics_events.metadata'ya yazıyor.
--   Hız sınırı var ama gövde boyutu yok: her çağrıda megabaytlarca JSON
--   yazılabiliyordu. Fonksiyonun gövdesine dokunmadan (birden çok sürümü
--   var) tabloya bir tavan konuyor: 2 KB'ı aşan metadata boşaltılır, olay
--   yine sayılır.

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
       file_size_limit    = 5 * 1024 * 1024
 where id in ('avatars', 'backgrounds', 'logos');

create or replace function public.analytics_events_metadata_tavan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.metadata is not null and octet_length(new.metadata::text) > 2048 then
    new.metadata := jsonb_build_object('kirpildi', true);
  end if;
  return new;
end;
$$;

revoke all on function public.analytics_events_metadata_tavan() from public, anon, authenticated;

do $mig$
begin
  if to_regclass('public.analytics_events') is not null then
    execute 'drop trigger if exists analytics_events_metadata_tavan_trg on public.analytics_events';
    execute 'create trigger analytics_events_metadata_tavan_trg before insert or update of metadata '
            'on public.analytics_events for each row execute function public.analytics_events_metadata_tavan()';
  end if;
end
$mig$;

-- >>>>>>>>>> 20261008103000_qr_sayi_eslestirme.sql
-- ============================================================================
-- İLGEZDİ QR GİRİŞİ: SAYI EŞLEŞTİRME VE AĞ ÖNEKİ
-- ============================================================================
--
-- Denetim bulgusu G-04 (08.10.2026), bağımsız inceleme H1 ve L7.
--
-- SORUN — QR ile oturum çalma (QRLjacking): saldırgan kendi bilgisayarında QR
-- üretip bir oltalama sayfasına koyar; kurban telefonundan "Onayla"ya basınca
-- oturum SALDIRGANIN tarayıcısında açılır. client_secret bu saldırıyı
-- durdurmaz: sırrı tutan zaten oturumu açan saldırgandır.
--
-- ÇÖZÜM — sayı eşleştirme: v2 istemci (client_secret alan) QR'ın yanında
-- 2 haneli bir sayı gösterir. Telefondaki onay ekranı üç sayı sunar; kişi
-- bilgisayar EKRANINDA gördüğünü seçer. Yanlış seçim oturumu yakar (üçte bir
-- tahmin şansı tek denemeyle sınırlı). Saldırganın ekranını görmeyen kurban
-- doğru sayıyı bilemez.
--
-- Eski (sırsız) istemcide sayı yok; o oturumlar eskisi gibi çalışır.
-- ILGEZDI_QR_STRICT=true açılınca eski istemci tamamen reddedilir.
--
-- AĞ ÖNEKİ: "aynı ağ mı" uyarısı tam IP'yi karşılaştırıyordu. IPv6'da aynı
-- evdeki iki cihazın adresi farklıdır (aynı /64 önek); uyarı yanlış alarm
-- veriyordu. Onay ekranı artık önek özetini karşılaştırır (IPv6 /64, IPv4
-- tam adres — NAT arkasındaki ev/ofis tek genel IPv4 paylaşır).

alter table public.ilgezdi_qr_sessions
  add column if not exists match_code smallint,
  add column if not exists creator_net_hash text;

comment on column public.ilgezdi_qr_sessions.match_code is
  'v2: QR yanında gösterilen 2 haneli sayı. Onay bu sayının seçilmesini ister; yanlış seçim oturumu yakar.';
comment on column public.ilgezdi_qr_sessions.creator_net_hash is
  'QR''ı üreten ağın önek özeti (IPv6 /64, IPv4 tam). Yalnızca onay ekranındaki "aynı ağ mı" bilgisi için.';

commit;
