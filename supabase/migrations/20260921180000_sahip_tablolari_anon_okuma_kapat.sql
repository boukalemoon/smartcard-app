-- Derinlemesine savunma: bu tablolar yalnızca SAHİBİNE ait veri tutuyor ve
-- ziyaretçinin erişimi SECURITY DEFINER fonksiyonlardan geçiyor (definer
-- sahibin yetkisiyle çalışır, anon iznine ihtiyacı yok).
--
-- Satır güvenliği zaten anon'a hiçbir şey döndürmüyordu (ölçüldü: 0 satır).
-- Ama tablo izni durduğu sürece, ileride biri yanlışlıkla gevşek bir politika
-- yazarsa ya da RLS bir şekilde kapanırsa kapı açık kalır. Bu projede tam bu
-- sınıftan hata daha önce yaşandı (members self-admin, profiles.email); izni
-- de kaldırıyoruz.
--
-- Doğrulandı: ziyaretçi yolları (kart, boş saatler, özel alan adı) çalışmaya
-- devam ediyor; ham tablo okuma denemesi 42501 ile reddediliyor.
revoke select on public.identity_verifications from anon;
revoke select on public.custom_domains        from anon;
revoke select on public.appointments          from anon;
revoke select on public.appointment_settings  from anon;
revoke select on public.card_contacts         from anon;
