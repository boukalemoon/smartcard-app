-- ============================================================================
-- tinga_listeler_acik: kural görünümden RLS'e taşındı
-- ============================================================================
--
-- SORUN (Supabase denetçisi, ERROR): görünüm SECURITY DEFINER varsayılanıyla
-- tanımlıydı. Yani SORGULAYANIN değil, görünümü OLUŞTURANIN yetkileriyle
-- çalışıyor ve tabloya konmuş satır güvenliği kurallarını tamamen atlıyordu.
-- "Herkese açık liste" kuralı bir GÖRÜNÜMÜN içinde saklıydı; tabloya doğrudan
-- bakan biri için aynı kural geçerli değildi. Kural, uygulandığı yerde durmalı.
--
-- ZAMANLAMA: tablo düzeltme anında BOŞTU (0 satır). Veri girmeden düzeltmek,
-- sonradan düzeltmekten hem ucuz hem risksiz.
--
-- YAPILAN:
--   1. Kural RLS politikası olarak yazıldı: gizli olmayan satırları herkes
--      okuyabilir. Artık tabloya doğrudan bakan için de aynı kural geçerli.
--   2. Görünüm security_invoker'a çevrildi; baypas kalktı.
--   3. anon'a yalnızca görünümün gösterdiği kolonlar verildi; qrtim_id
--      (liste sahibinin kimliği) giriş yapmamış ziyaretçiye kapalı.
--      DİKKAT: tablo geneline SELECT dururken tek kolonu geri almak
--      PostgreSQL'de İŞE YARAMAZ. Önce tablo yetkisi kaldırılır, sonra
--      yalnızca gereken kolonlar verilir.
--
-- DOĞRULANDI (geri alınan işlemde, biri gizli biri açık iki liste ile):
--   anon görünümde yalnızca açık listeyi gördü · gizli liste sızmadı ·
--   anon qrtim_id okuyamadı (42501) · anon tabloya doğrudan baktığında da
--   yalnızca açık listeyi gördü.

drop policy if exists "liste: acik olanlari herkes okur" on public.tinga_listeler;
create policy "liste: acik olanlari herkes okur" on public.tinga_listeler
  for select to anon, authenticated
  using (gizli = false);

alter view public.tinga_listeler_acik set (security_invoker = true);

revoke select on public.tinga_listeler from anon;
grant select (id, ad, parcalar, olusturma, gizli) on public.tinga_listeler to anon;

comment on view public.tinga_listeler_acik is
  'Herkese acik Tinga listeleri. security_invoker: sorgulayanin yetkisiyle calisir, kural RLS politikasindadir.';
