-- KEŞİF SORGUSU — çalıştırıp çıktısını paylaşın, yazmam gereken şeyler buna bağlı.
--
-- NEDEN GEREKLİ: referrals, commissions, referral_codes ve subscriptions
-- tabloları migration dosyaları yazılmaya başlamadan ÖNCE oluşturulmuş;
-- şemaları depoda yok. Komisyonu %10'a çevirmek, yönetim paneli ve partner
-- yenileme takibi bu tabloların gerçek hâline dokunacak. Tahminle yazarsam
-- para akışında hata olur.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur. 7 sonuç kümesi döner.

-- 1) Kolonlar
select 'KOLONLAR' as bolum, table_name, string_agg(column_name || ' ' || data_type
       || case when is_nullable = 'NO' then ' not null' else '' end, ', ' order by ordinal_position) as kolonlar
from information_schema.columns
where table_schema = 'public'
  and table_name in ('referrals','commissions','referral_codes','subscriptions','members','organizations')
group by table_name order by table_name;

-- 2) subscriptions üzerindeki tetikleyiciler — komisyon tetikleyicisinin
--    zamanlaması (before/after) ve olayları (insert/update) depoda yok.
select 'TETIKLEYICILER' as bolum, t.tgname,
       case t.tgtype & 1 when 1 then 'row' else 'statement' end as kapsam,
       case when (t.tgtype & 2) > 0 then 'before' else 'after' end as zamanlama,
       case when (t.tgtype & 4) > 0 then 'insert ' else '' end
       || case when (t.tgtype & 8) > 0 then 'delete ' else '' end
       || case when (t.tgtype & 16) > 0 then 'update ' else '' end as olaylar,
       p.proname as fonksiyon
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where c.relname = 'subscriptions' and not t.tgisinternal
order by t.tgname;

-- 3) Kısıtlar ve tekil indeksler — commissions'a ödeme başına satır
--    ekleyeceğim, mükerrer engeli var mı bilmem gerekiyor.
select 'KISITLAR' as bolum, c.relname as tablo, con.conname, pg_get_constraintdef(con.oid) as tanim
from pg_constraint con join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('referrals','commissions')
order by c.relname, con.conname;

-- 4) Mevcut yönetici fonksiyonlarının imzaları — yönetim paneli bunların
--    üstüne kurulacak, yenisini yazmadan önce ne olduğunu görmeliyim.
select 'YONETICI_RPC' as bolum, p.proname,
       pg_get_function_identity_arguments(p.oid) as parametreler,
       pg_get_function_result(p.oid) as doner, p.prosecdef as definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'admin_%' or p.proname in
       ('my_referrals','get_or_create_referral_code','get_platform_stats','my_plan_limits'))
order by p.proname;

-- 5) FİYAT KONTROLÜ — bugün uyguladığınız iki migration tuttu mu?
--    Beklenen: student 4900/49000, professional 15900/159000/183900(t),
--    stk 27900/279000, business 54900/549000; kart paketi yalnız
--    professional'da açık, diğerlerinde nfc_included = 0.
select 'FIYATLAR' as bolum, plan, period, with_nfc, amount_kurus, nfc_included, is_active
from public.plan_prices order by plan, period, with_nfc;

-- 6) Komisyon hasarı — sabit 50/75/150 ₺ yazan tetikleyici ne kadar yazmış?
select 'KOMISYON_DURUM' as bolum, type, status, count(*) as satir,
       sum(amount) as toplam_tl, min(amount) as en_az, max(amount) as en_cok
from public.commissions group by type, status order by type, status;

-- 7) Davet kayıtları — kaç davet var, kaçı ödemeye dönmüş?
select 'DAVETLER' as bolum, status, count(*) as satir, sum(commission_amount) as toplam_tl
from public.referrals group by status order by status;
