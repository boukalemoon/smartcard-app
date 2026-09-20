-- Eski (v:2 öncesi) QR oturumları için telafi önlemi.
--
-- İlgezdi istemci değişikliklerini RLS aşamasına bıraktı (Burak'ın kararı:
-- Supabase işleri tek seferde). O sürüme kadar sırsız oturumlar QR'ı gören
-- herkes tarafından yoklanabilir durumda kalacaktı. Bu yüzden sırsız
-- oturumlar, kodu ÜRETEN cihazın ağına bağlanıyor: başka bir ağdan gelen
-- yoklama oturumu göremez.
--
-- Not: yalnızca sırsız (eski) oturumlarda uygulanır. v:2 istemcisi
-- client_secret kullandığı için IP değişse bile çalışmaya devam eder.
-- Kontrolün kendisi ilgezdi-qr Edge Function'ındadır (ILGEZDI_QR_STRICT).
alter table public.ilgezdi_qr_sessions
  add column if not exists creator_ip_hash text;

comment on column public.ilgezdi_qr_sessions.creator_ip_hash is
  'Sırsız (eski protokol) oturumlarda QR kodu üreten istemcinin IP özeti. Yoklama yalnızca aynı ağdan kabul edilir.';
