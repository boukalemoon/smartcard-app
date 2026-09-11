-- ============================================================================
-- GEÇİŞ (CUTOVER) — EN SON UYGULANIR. DİKKAT: TEK BAŞINA UYGULAMAYIN.
-- ============================================================================
--
-- ⚠ Bu migration, yayındaki arayüz hâlâ tabloları doğrudan okuyorsa CANLI
--   SİTEYİ ANINDA KIRAR. Yalnızca aşağıdaki arayüz değişiklikleri dağıtılırken
--   uygulanmalıdır:
--     • PublicCard              -> get_public_card()
--     • PublicMemberDirectory   -> get_public_org_members()
--     • PublicMemberDirectoryPage / PublicApplicationPage -> get_public_organization()
--
--   Doğru sıra: ADIM 1-3 uygulanır (bunlar güvenlidir) -> yeni arayüz
--   dağıtılır -> doğrulanır -> ANCAK O ZAMAN bu adım uygulanır.
--
-- NE YAPAR:
--   anon rolünün tablo okuma AYRICALIĞINI kaldırır. RLS politikalarına hiç
--   dokunmaz — bu yüzden geri alması tek satırlık bir GRANT'tir ve mevcut
--   politika tanımları olduğu gibi korunur.
--
--   PostgREST önce tablo ayrıcalığına bakar; ayrıcalık yoksa politika hiç
--   değerlendirilmez. SECURITY DEFINER fonksiyonlar (get_public_card vb.)
--   sahibinin yetkisiyle çalıştığı için bu kısıtlamadan etkilenmez.
--
-- KAPATTIĞI BULGULAR: K-1 (21 kullanıcının e-posta/telefonu), K-2 (sahte
--   gizlilik anahtarları), Y-2 (33 kurum + üyelik grafiği), Y-4 (IBAN hasadı).

-- ---------------------------------------------------------------------------
-- 1) Tablo okuma ayrıcalıklarının kaldırılması
-- ---------------------------------------------------------------------------

revoke select on table public.profiles      from anon;
revoke select on table public.social_links  from anon;
revoke select on table public.members       from anon;
revoke select on table public.organizations from anon;

-- Not: anon'un analytics_events üzerindeki INSERT yetkisi bilinçli olarak
-- korunur (ziyaret izleme). applications üzerindeki INSERT de korunur
-- (herkese açık başvuru formu). Bu adım YALNIZCA okuma kaldırır.

-- ---------------------------------------------------------------------------
-- 2) Ödeme bilgisi ucunun doğrudan çağrılmasının kapatılması
-- ---------------------------------------------------------------------------
-- get_card_payment_info kullanıcı adına göre IBAN/vergi no/adres döndürüyor.
-- Kullanıcı adlarının tamamı K-1 üzerinden dökülebildiği için tek tek dönerek
-- toplu hasat mümkündü (bulgu Y-4). Artık yalnızca get_public_card içinden
-- çağrılabilir; o da SECURITY DEFINER olduğu için iç çağrı etkilenmez.

revoke execute on function public.get_card_payment_info(text) from anon;

-- ---------------------------------------------------------------------------
-- 3) Doğrulama
-- ---------------------------------------------------------------------------
-- Uygulamadan sonra anon anahtarla şunlar BOŞ/HATA dönmelidir:
--   GET /rest/v1/profiles?select=*         -> 401 permission denied
--   GET /rest/v1/organizations?select=*    -> 401 permission denied
--   POST /rest/v1/rpc/get_card_payment_info-> 401 permission denied
-- Şunlar ÇALIŞMAYA DEVAM ETMELİDİR:
--   POST /rest/v1/rpc/get_public_card        {"p_username":"burak-akmese"}
--   POST /rest/v1/rpc/get_public_organization{"p_org_id":"..."}
--   POST /rest/v1/rpc/increment_card_view    {"p_username":"..."}
--
-- GERİ ALMA (acil durum):
--   grant select on table public.profiles      to anon;
--   grant select on table public.social_links  to anon;
--   grant select on table public.members       to anon;
--   grant select on table public.organizations to anon;
--   grant execute on function public.get_card_payment_info(text) to anon;
