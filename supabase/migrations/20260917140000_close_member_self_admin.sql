-- ============================================================================
-- KRİTİK: herhangi bir kullanıcı herhangi bir kuruma kendini YÖNETİCİ ekleyebiliyordu
-- ============================================================================
--
-- BULGU (17.09.2026, panel analizi):
--   20260913100000_fix_corporate_panel.sql içindeki "uye ekleme" INSERT
--   politikası:  profile_id = my_profile_id() OR is_admin_of_org(organization_id)
--   Kendini ekleme dalında rol ve kurum sınırı yoktu.
--
-- DOĞRULAMA (geri alınan işlemde, sıradan bir kullanıcıyla):
--   insert into members (organization_id=ESİS, profile_id=kendisi, role='admin')
--   → BAŞARILI; is_admin_of_org false → true; görünen başvuru 0 → 2
--   (başvuranların ad/e-posta/telefonu), üye analitiği okunabilir hâle geldi.
--   Mevcut üye de satırını silip yeniden 'admin' olarak ekleyebiliyordu.
--
-- KÖTÜYE KULLANIM KONTROLÜ:
--   10 yönetici satırının 10'u kurumun kurucusu ve kurumla aynı saniyede
--   (create_organization) eklenmiş; tek istisna platform sahibinin onayıyla
--   bugün Pega'ya eklenen ve kayıt altındaki satır. İstismar izi yok.
--
-- ÇÖZÜM:
--   Kendini ekleme dalının meşru bir kullanımı yok: kurum oluşturma,
--   başvuru onayı ve e-postayla ekleme SECURITY DEFINER RPC'lerden geçiyor;
--   MemberManager doğrudan eklemeyi yönetici olarak yapıyor. Doğrudan
--   ekleme yalnızca kurum yöneticisine açık.
--   Kuruma katılmak isteyen kişi başvuru yapar; üyelik onayla oluşur.
--
-- EK: başvuru formu durum alanını istemciden alıyordu; başvuran kendi
--   başvurusunu 'approved' ve inceleyen bilgisiyle gönderebiliyordu.
--   Yeni başvuru yalnızca 'pending' ve incelenmemiş olarak yazılabilir.
--
-- EK 2: başvuru formu GİRİŞ YAPMAMIŞ ziyaretçi için hiç çalışmıyordu.
--   Politikadaki "exists (select 1 from organizations ...)" anon rolüyle
--   çalışıyor, anon'un organizations okuma yetkisi yok → "permission denied
--   for table organizations". Kurumun varlığını zaten
--   applications_organization_id_fkey garanti ediyor (FK kontrolü çağıranın
--   yetkisinden bağımsız); alt sorgu kaldırıldı.

drop policy if exists "uye ekleme" on public.members;

create policy "yonetici uye ekler" on public.members
  for insert to authenticated
  with check (public.is_admin_of_org(organization_id));

drop policy if exists "herkes basvuru gonderebilir" on public.applications;

create policy "herkes basvuru gonderebilir" on public.applications
  for insert to anon, authenticated
  with check (
    organization_id is not null
    and applicant_name is not null and btrim(applicant_name) <> ''
    and applicant_email is not null
    and applicant_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and coalesce(status, 'pending') = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );
