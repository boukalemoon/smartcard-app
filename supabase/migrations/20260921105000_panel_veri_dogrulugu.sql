-- Panel veri doğruluğu (denetim bulguları)
--
-- 1) Sayaç hizalaması: personas.view_count ile profiles.card_views aynı şeyi
--    söylesin. 34 personanın hepsi ANA profil; persona sisteminden önceki
--    görüntülenmelerin tamamı ana karta aitti.
update public.personas x
   set view_count = coalesce(p.card_views, 0)
  from public.profiles p
 where p.id = x.profile_id and x.is_primary
   and coalesce(x.view_count, 0) < coalesce(p.card_views, 0);

-- 2) my_card_analytics: kişinin kendi analitiği SUNUCUDA toplanır.
--    Panel olay satırlarını tarayıcıya çekip sayıyordu; PostgREST 1000 satır
--    döndürdüğü için 1000 olaydan sonra bütün kutular sessizce EKSİK
--    gösterecekti. Tarih filtresi de hiç uygulanmıyordu.
--    (Fonksiyon gövdesi için bkz. Supabase migration geçmişi:
--     panel_veri_dogrulugu)

-- 3) organizational_commissions: aynı dönemin iki kez hesaplanmasını önleyen
--    tekillik yoktu; fonksiyondaki ON CONFLICT dayanacak kısıt bulamıyordu.
create unique index if not exists organizational_commissions_donem_key
  on public.organizational_commissions (organization_id, period_year, period_month);
