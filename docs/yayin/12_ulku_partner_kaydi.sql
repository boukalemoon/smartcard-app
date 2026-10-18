-- ============================================================================
-- Ülkü: partner kaydı
-- ============================================================================
--
-- Ülkü (Desktop/bodun) ekosistemdeki bir uygulama. QRtım bağlantısı YALNIZCA
-- kimlik bağlama için: plan ve senkron istenmedi. Ülkü'de QRtım ile giriş
-- ÜYELİK VERMEZ — Ülkü'de zaten oturumu olan üye hesabını bağlar.
-- Burak onayı: 18.10.2026.
--
-- Bu satır olmadan ulku-link çalışmaz: partner_user_links.partner ve
-- user_sync_data.app_key, integration_providers(key)'e yabancı anahtarla
-- bağlı.
--
-- capabilities BOŞ: senkron istenmedi. İstenirse buraya yazılır.

insert into public.integration_providers (key, name, kind, is_first_party, is_active)
values ('ulku', 'Ülkü', 'sso', true, true)
on conflict (key) do update
  set name = excluded.name,
      kind = excluded.kind,
      is_first_party = excluded.is_first_party,
      is_active = excluded.is_active;
