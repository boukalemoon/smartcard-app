-- ============================================================================
-- Şifreli katman 1. ADIM: notlar da kasa verisi sayılıyor
-- ============================================================================
--
-- KARAR (Burak, 19.10.2026): "notlar şifreli katmanda olsun çünkü kişilerin
-- kendi notlarını kayıt etmesi ve geri getirmesi önemli. Ayrıca almak
-- istediği notlar kritik notlar olabileceği için şifreli olarak kayıt
-- etmemizde yarar var."
--
-- İlgezdi'nin notes.js modülü de bunu bekliyor: "QRtım hesabıyla uçtan uca
-- şifreli senkron, RLS aşamasında bunun üstüne kurulur." Notlar ana süreçte
-- ZATEN şifreli dosyada duruyor; buluta düz metin yazmak yereldeki korumayı
-- geriletirdi. Tasarım belgesinde notları şifresiz katmana koymuştum, o
-- yanlıştı (docs/ilgezdi-senkron-sifreleme.md güncellendi).
--
-- Bu dosya 20261018110000'deki kuralları 'notes' türüne de uygular:
--   • Düz metin YAZILAMAZ (kısıt — service_role dahil kimse).
--   • Yazmak için şifreli bulut yedeği hakkı gerekir (ücretli plan).
--
-- NEDEN NOTLAR DA ÜCRETLİ: ayrım "ücretsizde yerel, abonelikte bulut yedeği"
-- (Burak'ın kararı). Not senkronu bugün HİÇ YOK, yani kimseden bir şey
-- alınmıyor — ayarlar ve yer imleri ücretsizde çalışmaya devam ediyor.
-- Ücretsiz yapılmak istenirse değişecek yer aşağıdaki iki politikadır.

-- ---------------------------------------------------------------------------
-- 1) Kısıt: kasa türleri düz metin olamaz
-- ---------------------------------------------------------------------------
-- Politika değil KISIT: service_role da dahil hiç kimse, hiçbir yoldan
-- şifresiz yazamaz. Arayüz hatası da buraya çarpar.
alter table public.user_sync_data
  drop constraint if exists user_sync_data_sifre_sifreli_olmali;
alter table public.user_sync_data
  add constraint user_sync_data_sifre_sifreli_olmali
  check (data_type not in ('passwords', 'notes') or is_encrypted = true);

comment on constraint user_sync_data_sifre_sifreli_olmali on public.user_sync_data is
  'Kasa turleri (passwords, notes) yalniz sifreli yazilabilir. settings ve bookmarks duz kalir.';

-- ---------------------------------------------------------------------------
-- 2) Yazma politikaları: kasa türleri hak ister
-- ---------------------------------------------------------------------------
-- senkron_sifre_hakki() plan_features.sync_passwords'tan okuyor. Ad "sifre"
-- diyor ama anlamı "şifreli bulut yedeği hakkı": notlar da aynı haktan
-- geçiyor, ikinci bir bayrak açmak iki ayrı doğruluk kaynağı yaratırdı.
drop policy if exists "kendi senkron verisini yazar" on public.user_sync_data;
create policy "kendi senkron verisini yazar"
  on public.user_sync_data for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (data_type not in ('passwords', 'notes')
         or (public.senkron_sifre_hakki() and is_encrypted))
  );

drop policy if exists "kendi senkron verisini gunceller" on public.user_sync_data;
create policy "kendi senkron verisini gunceller"
  on public.user_sync_data for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (data_type not in ('passwords', 'notes')
         or (public.senkron_sifre_hakki() and is_encrypted))
  );

-- Silme koşulsuz kalıyor: kendi verisi, abonelik bitse de silebilmeli.

comment on function public.senkron_sifre_hakki() is
  'Sifreli bulut yedegi hakki (kasa turleri: passwords, notes). Suresi dolmus abonelik ucretsiz sayilir (tanim my_plan_limits ile ayni).';

comment on table public.user_sync_data is
  'Uygulama basina senkron verisi. Kasa turleri (passwords, notes) YALNIZ sifreli (kisit) ve yalniz hakki olan planda yazilir; abonelik bitince okuma surer, yazma durur. settings ve bookmarks ucretsizde de yazilir.';
