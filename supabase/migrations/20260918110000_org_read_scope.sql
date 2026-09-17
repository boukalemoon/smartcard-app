-- ============================================================================
-- KURUM VE ÜYE VERİSİNDE OKUMA KAPSAMI
-- ============================================================================
--
-- BULGU 1: organizations okuma kuralı "true" idi. Giriş yapmış HERKES bütün
--   kurumların e-posta, telefon, adres ve ayarlarını okuyabiliyordu. Kurum
--   kimliklerinin kolayca toplanabilmesi, kapattığımız "kendini yönetici
--   ekleme" açığının da ilk adımıydı.
--   Herkese açık sayfalar (başvuru formu, üye dizini) zaten RPC üzerinden
--   çalışıyor: get_public_organization / get_public_org_members. Bunlar
--   SECURITY DEFINER olduğu için kısıtlamadan etkilenmez ve yalnızca
--   kurumun herkese açık alanlarını döndürür.
--
-- BULGU 2: members satırlarını kurumun her üyesi ham olarak okuyabiliyordu;
--   yöneticinin elle girdiği e-posta ve telefon da buna dahildi. Arayüz artık
--   org_member_list RPC'sini kullanıyor (iletişim bilgisi yalnızca yöneticiye
--   ve kişinin kendisine döner). Tablo seviyesinde de bu iki kolonun okuma
--   yetkisi kaldırılıyor ki ileride biri doğrudan sorgulamaya kalkmasın.

drop policy if exists "Anyone can view organizations" on public.organizations;

create policy "uye kurumunu gorur" on public.organizations
  for select to authenticated
  using (public.is_member_of_org(id) or public.is_admin());

-- İletişim kolonları yalnızca RPC üzerinden (definer) okunur.
--
-- DİKKAT: Tablonun TAMAMI için okuma yetkisi verilmişken tek kolonu geri
-- almak PostgreSQL'de işe YARAMAZ (denendi: e-posta hâlâ okunabiliyordu).
-- Önce tablo yetkisi kaldırılır, sonra yalnızca gereken kolonlar verilir.
revoke select on public.members from authenticated;
grant select (id, organization_id, profile_id, role, status, name,
              joined_at, created_at, updated_at)
  on public.members to authenticated;
