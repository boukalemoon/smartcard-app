-- ============================================================================
-- The Draw: partner kaydı
-- ============================================================================
--
-- The Draw (Desktop/the-draw) ekosistemdeki modüllerin kullanıcı arayüzü ve
-- sosyal alanı; kendi kimlik merkezi var (Go + PostgreSQL + Ory). QRtım
-- bağlantısı isteğe bağlı: kullanıcı Draw'da QRtım'sız da hesap açabiliyor.
--
-- Bu satır olmadan draw-link çalışmaz: partner_user_links.partner ve
-- user_sync_data.app_key, integration_providers(key)'e yabancı anahtarla
-- bağlı. (Draw oturumunun listesinde bu adım yoktu, eklendi.)
--
-- capabilities BOŞ bırakıldı: Draw şimdilik yalnız kimlik bağlama istiyor.
-- Senkron alanları (profil, kart, okutma geçmişi, Draw rozet/istatistikleri)
-- Draw M01 planı onaylanınca ayrıca istenecek; o zaman buraya yazılır.

insert into public.integration_providers (key, name, kind, is_first_party, is_active)
values ('thedraw', 'The Draw', 'sso', true, true)
on conflict (key) do update
  set name = excluded.name,
      kind = excluded.kind,
      is_first_party = excluded.is_first_party,
      is_active = excluded.is_active;
