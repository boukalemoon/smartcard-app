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
