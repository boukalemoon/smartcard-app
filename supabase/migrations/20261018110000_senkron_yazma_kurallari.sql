-- ============================================================================
-- user_sync_data: yazma kuralları, şifre kasası şartı ve yetki temizliği
-- ============================================================================
--
-- ÖLÇÜLEN (18.10.2026, canlı):
--   • Tabloda YALNIZ bir SELECT politikası vardı ("kendi senkron verisini
--     okur"). INSERT/UPDATE/DELETE politikası YOKTU → RLS açık olduğu için
--     istemci bu tabloya HİÇ YAZAMIYORDU. İlgezdi'nin hâlâ eski
--     ilgezdi_sync_data tablosuna yazmasının sebebi bu; gözden kaçma değil,
--     yeni katmanın yazma yolu hiç açılmamış.
--   • anon rolünde INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER yetkileri
--     duruyordu. RLS yazmayı zaten kesiyordu ama TRUNCATE RLS'i DELMEZ:
--     tablo düzeyi yetki olarak kalması, ileride biri izin verici bir yazma
--     politikası eklediğinde kapıyı açık bırakır. Oturumda daha önce başka
--     tablolarda yapılan temizliğin aynısı buraya uygulanmamış.
--   • size_bytes istemci tarafından yazılabiliyordu: istemci yalan söyleyip
--     depolama tavanını atlatabilirdi.
--
-- ABONELİK AYRIMI (Burak kararı 18.10.2026):
--   Ücretsiz → şifre kasası yalnız cihazda. Ücretli → şifreli bulut yedeği.
--   Abonelik BİTERSE yedek SİLİNMEZ ve okunabilir kalır; yalnız yazma durur.
--   Süresi dolmuş abonelik "ücretsiz" sayılır (tanım my_plan_limits ile aynı
--   tutuldu, tek kaynak). Kullanıcı ücretsizden devam eder, yeni şifreler
--   yerel kasaya gider — bu yönlendirmeyi İlgezdi arayüzü yapar, sunucu
--   yalnız yazmayı reddeder.
--
--   Ayarlar, yer imleri ve notlar ücretsizde de senkronlanmaya DEVAM EDER.
--   Bugünkü davranış bu (ilgezdi_sync_data plan sormuyor); aboneliğe bağlamak
--   mevcut kullanıcılardan çalışan bir özelliği geri almak olurdu. Ayrımın
--   şifrede olmasını Burak söyledi. Aksi kararı verilirse değişecek yer
--   aşağıdaki iki politikadır.

-- ---------------------------------------------------------------------------
-- 1) Şifre senkronu hakkı
-- ---------------------------------------------------------------------------
-- Plan tanımı my_plan_limits'tekiyle birebir: aktif ve süresi geçmemiş
-- abonelik; yoksa 'free'. Hak plan_features.sync_passwords'tan okunur,
-- kodda plan adı listelenmez.
create or replace function public.senkron_sifre_hakki()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pf.sync_passwords
      from public.plan_features pf
     where pf.plan = coalesce((
       select s.plan
         from public.subscriptions s
        where s.profile_id = public.my_profile_id()
          and s.status = 'active'
          and (s.expires_at is null or s.expires_at > now())
        order by s.created_at desc
        limit 1
     ), 'free')
  ), false);
$$;

revoke all on function public.senkron_sifre_hakki() from public, anon;
grant execute on function public.senkron_sifre_hakki() to authenticated;

comment on function public.senkron_sifre_hakki() is
  'Sifre kasasini buluta yedekleme hakki var mi? Suresi dolmus abonelik ucretsiz sayilir (tanim my_plan_limits ile ayni).';

-- ---------------------------------------------------------------------------
-- 2) Veri değişmezi: şifre satırı ASLA düz metin olamaz
-- ---------------------------------------------------------------------------
-- Politika değil KISIT: service_role da dahil hiç kimse, hiçbir yoldan
-- şifre kasasını şifresiz yazamaz. Arayüz hatası da buraya çarpar.
alter table public.user_sync_data
  drop constraint if exists user_sync_data_sifre_sifreli_olmali;
alter table public.user_sync_data
  add constraint user_sync_data_sifre_sifreli_olmali
  check (data_type <> 'passwords' or is_encrypted = true);

-- ---------------------------------------------------------------------------
-- 3) Boyut: ZATEN VAR, dokunulmuyor
-- ---------------------------------------------------------------------------
-- Mevcut user_sync_data_guard_trg tetikleyicisi size_bytes'i sunucuda
-- (pg_column_size) hesaplayip 5 MB tavanini uyguluyor ve updated_at'i
-- yaziyor. Istemcinin verdigi size_bytes zaten yoksayiliyor.
-- Buraya ikinci bir BEFORE tetikleyicisi eklemek ikisinin de size_bytes
-- yazmasina ve calisma sirasina gore farkli sonuca yol acardi.

-- ---------------------------------------------------------------------------
-- 4) Yazma politikaları — yoktu, açılıyor
-- ---------------------------------------------------------------------------
-- Şifre satırı iki şart ister: hak VE şifreli olması. Diğer veri türleri
-- (settings, bookmarks, notes) her oturumlu kullanıcıda kendi satırına yazılır.
drop policy if exists "kendi senkron verisini yazar" on public.user_sync_data;
create policy "kendi senkron verisini yazar"
  on public.user_sync_data for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (data_type <> 'passwords'
         or (public.senkron_sifre_hakki() and is_encrypted))
  );

drop policy if exists "kendi senkron verisini gunceller" on public.user_sync_data;
create policy "kendi senkron verisini gunceller"
  on public.user_sync_data for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (data_type <> 'passwords'
         or (public.senkron_sifre_hakki() and is_encrypted))
  );

-- Silme her zaman serbest: kendi verisi. Abonelik bitse de silebilmeli.
drop policy if exists "kendi senkron verisini siler" on public.user_sync_data;
create policy "kendi senkron verisini siler"
  on public.user_sync_data for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5) Yetki temizliği
-- ---------------------------------------------------------------------------
-- TRUNCATE RLS'i DELER: tablo düzeyinde kalmamalı. REFERENCES ve TRIGGER de
-- istemci rollerinin işi değil.
revoke all on public.user_sync_data from anon;
revoke truncate, references, trigger on public.user_sync_data from authenticated;
grant select, insert, update, delete on public.user_sync_data to authenticated;

comment on table public.user_sync_data is
  'Uygulama basina senkron verisi. passwords satiri YALNIZ sifreli (kisit) ve yalnız sync_passwords hakki olan planda yazilir; abonelik bitince okuma surer, yazma durur.';
