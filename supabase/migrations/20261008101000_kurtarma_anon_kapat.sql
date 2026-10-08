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
