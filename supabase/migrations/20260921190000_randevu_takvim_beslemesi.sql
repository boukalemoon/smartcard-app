-- ============================================================================
-- TAKVİM BESLEMESİ (ICS)
-- ============================================================================
--
-- SORU (Burak, 21.09.2026): kullanıcıların kimi Gmail, kimi Hotmail, kimi
-- kurumsal alan adı kullanıyor. Her biri için ayrı takvim entegrasyonu mu
-- yazacağız?
--
-- HAYIR. ICS (iCalendar) bir STANDART; Google Takvim, Outlook/Hotmail, Apple
-- Takvim ve kurumsal Exchange hepsi destekliyor. Kimsenin bize hesabını
-- bağlaması ya da OAuth izni vermesi gerekmiyor. Sağlayıcı başına entegrasyon
-- (Google Calendar API + Microsoft Graph + ...) hem her biri için ayrı
-- uygulama onayı, hem de kullanıcıdan takvimine YAZMA izni istemek demekti.
--
-- İKİ YÖN:
--   • Kart sahibi → ABONELİK adresi (/api/takvim.ics). Takvim uygulamasına
--     bir kez eklenir, randevular kendiliğinden düşer ve güncellenir.
--   • Randevuyu alan kişi → tek seferlik "takvimime ekle" dosyası; TARAYICIDA
--     üretilir (src/utils/takvim.js), sunucuya hiç gitmez. Hatırlatmayı da
--     kişinin kendi takvimi yapar, bizim e-posta göndermemize gerek kalmaz.
--
-- ADRES BİR ANAHTARDIR: adresi bilen randevuları görür. Bu yüzden tahmin
-- edilemez (128 bit), biçimi sıkı denetlenir, hız sınırı vardır ve kullanıcı
-- istediğinde yenilenebilir — sızdığında adresi değiştirmek tek çare olmalı.
--
-- NEDEN EDGE FUNCTION DEĞİL: takvim uygulamaları bir adrese abone olurken
-- özel başlık gönderemez; Supabase Edge Function'ları JWT başlığı bekler.
-- Besleme bu yüzden Vercel tarafında (api/takvim.ics.js).

alter table public.appointment_settings
  add column if not exists takvim_anahtari text;

update public.appointment_settings
   set takvim_anahtari = encode(extensions.gen_random_bytes(16), 'hex')
 where takvim_anahtari is null;

alter table public.appointment_settings
  alter column takvim_anahtari set default encode(extensions.gen_random_bytes(16), 'hex');

create unique index if not exists appointment_settings_takvim_anahtari_key
  on public.appointment_settings (takvim_anahtari);

comment on column public.appointment_settings.takvim_anahtari is
  'Takvim abonelik adresindeki gizli anahtar. Adresi bilen randevulari gorur; sizarsa yenilenir.';

-- Fonksiyonlar (tam gövdeleri Supabase göç geçmişinde 'randevu_takvim_beslemesi'):
--   appointment_calendar_feed(anahtar) — oturumsuz; biçim denetimi + hız
--       sınırı. İPTAL edilen randevular da döner: ICS'te silme STATUS:CANCELLED
--       ile olur, göndermezsek abonenin takviminde silinmiş randevu asılı
--       kalırdı.
--   my_calendar_key() / rotate_calendar_key()
--
-- Doğrulandı (geri alınan işlemde): anahtar 32 karakter · oturumsuz besleme
-- çalışıyor · yanlış anahtar NULL · biçimsiz anahtar NULL · anahtar
-- yenilendikten sonra eski anahtar NULL.
