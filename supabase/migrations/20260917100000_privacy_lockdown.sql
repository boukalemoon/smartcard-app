-- ============================================================================
-- GİZLİLİK KİLİDİ — dijital kimliğin temel sözü
-- ============================================================================
--
-- Hepsi sıradan bir kullanıcı (hebe@lup.com) olarak, geri alınan işlemde
-- denenerek doğrulandı (17.09.2026).
--
-- S1 — "GİZLİ" İŞARETİ KAYITLI HERKESE KARŞI İŞE YARAMIYORDU (yüksek)
--   profiles tablosunda iki ayrı SELECT USING(true) kuralı vardı.
--   bengikalyoncu@yahoo.com ve burak@burakduru.com e-postalarını GİZLİ
--   işaretlemiş. Kartta doğru şekilde görünmüyor — ama giriş yapmış herhangi
--   bir kullanıcı tek sorguyla e-postalarını VE telefonlarını okuyabildi.
--   35 profilin tamamı, 9 telefon numarası, tüm roller açıktı.
--
-- S2 — HERKES HERKESİN FOTOĞRAFINI/LOGOSUNU DEĞİŞTİREBİLİYORDU (yüksek)
--   avatars ve logos için UPDATE/DELETE kuralı yalnızca klasör adına
--   bakıyordu. Sıradan kullanıcı 28 dosyanın 28'ini değiştirebildi.
--
-- S3 — PLAN SINIRI VE ATOMİK OLUŞTURMA ATLATILABİLİYORDU
--   organizations doğrudan INSERT'e açıktı (WITH CHECK true). Ücretsiz
--   planda 5 sahipsiz organizasyon açılabildi.
--
-- S4 — FATURALAMA BAYRAKLARI İSTEMCİDE
--   %20 toplu indirim bayrağını ve üye sayısını tarayıcı yazıyordu.
--
-- YAN BULGULAR (sessizce bozuk özellikler):
--   • Kurumsal analitik: get_org_member_analytics çağıranın yetkisiyle
--     çalışıyor, olaylar yalnızca sahibine görünüyor → yönetici diğer
--     üyelerin tüm sayılarını 0 görüyordu.
--   • AdminCRM "rol değiştir": profiles güncelleme kuralı yalnızca kendi
--     profiline açık → başka kullanıcıda 0 satır, ekranda "güncellendi".
--   • AdminCRM listeleri: abonelik/komisyon/davet tablolarında yönetici okuma
--     kuralı yoktu → yönetici yalnızca kendi satırlarını görüyordu.
--   • Başvuru onayı: durumu "onaylandı" yapıp, kişinin hesabı yoksa üyeyi
--     eklemiyordu → onaylı ama üye olmayan başvurular.
--   • Açılış sayfası istatistikleri anonim okumaya kapatıldığından beri 0.
--
-- Profil okuması kapandığı için başka profile dokunan her özellik, yalnızca
-- gereken alanı döndüren ve yetkiyi kendisi kontrol eden bir fonksiyona
-- taşındı.

-- ===========================================================================
-- S1 — profiles
-- ===========================================================================

drop policy if exists "Anyone can view profiles" on public.profiles;
drop policy if exists "profiles_select"          on public.profiles;

drop policy if exists "kendi profilini okur" on public.profiles;
create policy "kendi profilini okur"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "yonetici profilleri okur" on public.profiles;
create policy "yonetici profilleri okur"
  on public.profiles for select to authenticated
  using (public.is_admin());

-- Yönetici paneli için okuma kuralları (önceden yoktu)
drop policy if exists "yonetici abonelikleri okur" on public.subscriptions;
create policy "yonetici abonelikleri okur"
  on public.subscriptions for select to authenticated using (public.is_admin());

drop policy if exists "yonetici komisyonlari okur" on public.commissions;
create policy "yonetici komisyonlari okur"
  on public.commissions for select to authenticated using (public.is_admin());

drop policy if exists "yonetici davetleri okur" on public.referrals;
create policy "yonetici davetleri okur"
  on public.referrals for select to authenticated using (public.is_admin());

drop policy if exists "yonetici kurum komisyonlarini okur" on public.organizational_commissions;
create policy "yonetici kurum komisyonlarini okur"
  on public.organizational_commissions for select to authenticated using (public.is_admin());

-- ===========================================================================
-- S2 — depolama: yalnızca dosyanın sahibi değiştirir/siler
-- ===========================================================================
-- Dosyalar klasörsüz adlandırılıyor, sahiplik owner_id'de (28/28 dolu).

drop policy if exists "Allow authenticated delete avatars" on storage.objects;
drop policy if exists "Allow authenticated delete logos"   on storage.objects;
drop policy if exists "Allow authenticated update avatars" on storage.objects;
drop policy if exists "Allow authenticated update logos"   on storage.objects;

create policy "gorsel sahibi siler"
  on storage.objects for delete to authenticated
  using (bucket_id in ('avatars','logos') and owner_id = (select auth.uid())::text);

create policy "gorsel sahibi gunceller"
  on storage.objects for update to authenticated
  using (bucket_id in ('avatars','logos') and owner_id = (select auth.uid())::text)
  with check (bucket_id in ('avatars','logos') and owner_id = (select auth.uid())::text);

-- ===========================================================================
-- S3 / S4 — organizations
-- ===========================================================================

-- Organizasyon yalnızca create_organization ile açılır (plan sınırı + atomik).
drop policy if exists "Authenticated users can create organizations" on public.organizations;

-- Sistem alanları istemciden değiştirilemez. Hata fırlatmak yerine eski
-- değer korunur: formlar bayat üye sayısıyla kaydedildiğinde kaydın tamamı
-- başarısız olmasın. Değiştirme denemesi denetim kaydına düşer.
--
-- DİKKAT — bu tetikleyici BİLEREK SECURITY DEFINER DEĞİL: definer olsaydı
-- içeride current_user her zaman fonksiyon sahibi olurdu ve "istemciden mi
-- geliyor" kontrolü asla tutmazdı. sync_org_member_count gibi sunucu
-- fonksiyonları (definer) üye sayısını yazmaya devam edebilir.

-- Dar kapsamlı kayıt yazıcı: yalnızca bu olayı, yalnızca çağıranın adına yazar.
create or replace function public.log_protected_write(p_resource_type text, p_resource_id text, p_cols text[])
returns void
language sql
security definer
set search_path = ''
as $fn$
  select public.log_event('protected_column_write', auth.uid(), 'qrtim',
                          left(coalesce(p_resource_type, ''), 40), left(coalesce(p_resource_id, ''), 64),
                          'denied', 'warning', 'internal',
                          jsonb_build_object('alanlar', to_jsonb(p_cols[1:10])));
$fn$;

revoke all on function public.log_protected_write(text, text, text[]) from public, anon;
grant execute on function public.log_protected_write(text, text, text[]) to authenticated;

create or replace function public.organizations_protect_system_columns()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare v_deneme text[] := '{}';
begin
  if current_user in ('authenticated', 'anon') then
    if new.subscription_plan    is distinct from old.subscription_plan    then v_deneme := v_deneme || 'subscription_plan'::text;    new.subscription_plan    := old.subscription_plan;    end if;
    if new.subscription_status  is distinct from old.subscription_status  then v_deneme := v_deneme || 'subscription_status'::text;  new.subscription_status  := old.subscription_status;  end if;
    if new.bulk_discount_active is distinct from old.bulk_discount_active then v_deneme := v_deneme || 'bulk_discount_active'::text; new.bulk_discount_active := old.bulk_discount_active; end if;
    if new.member_count         is distinct from old.member_count         then v_deneme := v_deneme || 'member_count'::text;         new.member_count         := old.member_count;         end if;
    if new.created_by           is distinct from old.created_by           then v_deneme := v_deneme || 'created_by'::text;           new.created_by           := old.created_by;           end if;

    if array_length(v_deneme, 1) > 0 then
      perform public.log_protected_write('organization', old.id::text, v_deneme);
    end if;
  end if;

  -- Toplu indirim türetilir, yazılmaz.
  new.bulk_discount_active := coalesce(new.member_count, 0) >= 10;
  return new;
end;
$fn$;

revoke all on function public.organizations_protect_system_columns() from public, anon, authenticated;

drop trigger if exists organizations_protect_system_columns_trg on public.organizations;
create trigger organizations_protect_system_columns_trg
  before update on public.organizations
  for each row execute function public.organizations_protect_system_columns();

-- ===========================================================================
-- Profil okuması kapanınca gereken dar fonksiyonlar
-- ===========================================================================

-- Kullanıcı adı müsait mi (kullanıcı adları zaten herkese açık kart adresi)
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select not exists (
    select 1 from public.profiles p
     where lower(p.username) = lower(btrim(coalesce(p_username, '')))
       and p.user_id is distinct from auth.uid()
  );
$fn$;

revoke all on function public.is_username_available(text) from public, anon;
grant execute on function public.is_username_available(text) to authenticated;

-- Organizasyon üye listesi — yalnızca o organizasyonun üyeleri görür.
-- Ünvan/şirket yalnızca kişi kartında paylaşıma açtıysa döner.
create or replace function public.org_member_list(p_org_id uuid)
returns table (
  id uuid, profile_id uuid, name text, email text, phone text, role text,
  status text, joined_at timestamptz, avatar_url text, title text,
  company text, is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select m.id, m.profile_id, m.name, m.email, m.phone, m.role, m.status,
         coalesce(m.joined_at, m.created_at),
         p.avatar_url,
         case when exists (select 1 from public.profile_fields f
                            where f.profile_id = p.id and f.field_key = 'title'
                              and f.persona = 'default' and f.visibility = 'public')
              then p.title end,
         case when exists (select 1 from public.profile_fields f
                            where f.profile_id = p.id and f.field_key = 'company'
                              and f.persona = 'default' and f.visibility = 'public')
              then p.company end,
         (m.profile_id is not null and m.profile_id = public.my_profile_id())
    from public.members m
    left join public.profiles p on p.id = m.profile_id
   where m.organization_id = p_org_id
     and public.is_member_of_org(p_org_id)
   order by (m.role = 'admin') desc, m.name nulls last;
$fn$;

revoke all on function public.org_member_list(uuid) from public, anon;
grant execute on function public.org_member_list(uuid) to authenticated;

-- E-postayla üye ekleme — yalnızca yönetici, saatte 30 sorgu.
-- Sınır: herkes ücretsiz organizasyon açıp yönetici olabildiği için bu uç,
-- "bu e-posta QRtım'da kayıtlı mı" taraması için kötüye kullanılabilir.
create or replace function public.org_add_member_by_email(p_org_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_prof uuid; v_ad text; v_sayi int;
begin
  if not public.is_admin_of_org(p_org_id) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if (select count(*) from public.audit_log a
       where a.action = 'org.member_lookup' and a.actor_user_id = auth.uid()
         and a.occurred_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  select p.id into v_prof from public.profiles p
   where lower(p.email) = lower(btrim(coalesce(p_email, ''))) limit 1;

  perform public.log_event('org.member_lookup', auth.uid(), 'qrtim', 'organization',
                           p_org_id::text, case when v_prof is null then 'failure' else 'success' end,
                           'info', 'internal', jsonb_build_object('bulundu', v_prof is not null));

  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'kullanici_bulunamadi');
  end if;

  if exists (select 1 from public.members m where m.organization_id = p_org_id and m.profile_id = v_prof) then
    return jsonb_build_object('ok', false, 'hata', 'zaten_uye');
  end if;

  insert into public.members (organization_id, profile_id, role, status)
  values (p_org_id, v_prof, 'member', 'active')
  returning name into v_ad;

  select count(*) into v_sayi from public.members m where m.organization_id = p_org_id;

  return jsonb_build_object('ok', true, 'ad', v_ad, 'uye_sayisi', v_sayi);
end;
$fn$;

revoke all on function public.org_add_member_by_email(uuid, text) from public, anon;
grant execute on function public.org_add_member_by_email(uuid, text) to authenticated;

-- Başvuru sonuçlandırma — onaylanan başvuru HER ZAMAN üye olur.
-- Hesabı varsa profiline bağlanır; yoksa başvuru bilgileriyle kayıtlı üye
-- olarak eklenir (önceden "onaylandı" deyip üyeyi eklemiyordu).
create or replace function public.approve_application(p_application_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_app  public.applications;
  v_prof uuid;
  v_eklendi boolean := false;
begin
  select * into v_app from public.applications a where a.id = p_application_id;
  if v_app.id is null then
    return jsonb_build_object('ok', false, 'hata', 'basvuru_bulunamadi');
  end if;
  if not public.is_admin_of_org(v_app.organization_id) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_karar');
  end if;
  if v_app.status <> 'pending' then
    return jsonb_build_object('ok', false, 'hata', 'zaten_sonuclandi', 'durum', v_app.status);
  end if;

  update public.applications
     set status = p_decision, reviewed_at = now(), reviewed_by = public.my_profile_id()
   where id = v_app.id;

  if p_decision = 'approved' then
    select p.id into v_prof from public.profiles p
     where lower(p.email) = lower(btrim(v_app.applicant_email)) limit 1;

    if v_prof is not null then
      if not exists (select 1 from public.members m
                      where m.organization_id = v_app.organization_id and m.profile_id = v_prof) then
        insert into public.members (organization_id, profile_id, role, status)
        values (v_app.organization_id, v_prof, 'member', 'active');
        v_eklendi := true;
      end if;
    else
      if not exists (select 1 from public.members m
                      where m.organization_id = v_app.organization_id and m.profile_id is null
                        and lower(m.email) = lower(btrim(v_app.applicant_email))) then
        insert into public.members (organization_id, profile_id, name, email, phone, role, status)
        values (v_app.organization_id, null, v_app.applicant_name, v_app.applicant_email,
                v_app.applicant_phone, 'member', 'active');
        v_eklendi := true;
      end if;
    end if;
  end if;

  perform public.log_event('application.decided', auth.uid(), 'qrtim', 'application', v_app.id::text,
                           'success', 'notice', 'internal',
                           jsonb_build_object('karar', p_decision, 'uye_eklendi', v_eklendi,
                                              'hesap_bagli', v_prof is not null));

  return jsonb_build_object('ok', true, 'karar', p_decision,
                            'uye_eklendi', v_eklendi, 'hesap_bagli', v_prof is not null);
end;
$fn$;

revoke all on function public.approve_application(uuid, text) from public, anon;
grant execute on function public.approve_application(uuid, text) to authenticated;

-- Yönetici rol değişikliği — denetimli
create or replace function public.admin_set_role(p_profile_id uuid, p_role text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_eski text; v_hedef uuid;
begin
  if not public.is_admin() then
    perform public.log_event('admin.set_role', auth.uid(), 'qrtim', 'profile', p_profile_id::text,
                             'denied', 'critical', 'internal', jsonb_build_object('istenen', p_role));
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;
  if p_role not in ('user', 'admin') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_rol');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'hata', 'gerekce_zorunlu');
  end if;

  select p.role, p.user_id into v_eski, v_hedef from public.profiles p where p.id = p_profile_id;
  if v_hedef is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_bulunamadi');
  end if;
  if v_hedef = auth.uid() then
    return jsonb_build_object('ok', false, 'hata', 'kendi_rolunu_degistiremezsin');
  end if;
  if v_eski in ('admin','superadmin') and p_role = 'user'
     and (select count(*) from public.profiles p where p.role in ('admin','superadmin')) <= 1 then
    return jsonb_build_object('ok', false, 'hata', 'son_yonetici');
  end if;

  update public.profiles set role = p_role where id = p_profile_id;

  perform public.log_event('admin.set_role', auth.uid(), 'qrtim', 'profile', p_profile_id::text,
                           'success', 'critical', 'user',
                           jsonb_build_object('eski_rol', v_eski, 'yeni_rol', p_role, 'gerekce', p_reason),
                           null, null, null, null, v_hedef);

  return jsonb_build_object('ok', true, 'eski_rol', v_eski, 'yeni_rol', p_role);
end;
$fn$;

revoke all on function public.admin_set_role(uuid, text, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text, text) to authenticated;

-- Açılış sayfası: yalnızca toplamlar, kişisel veri yok
create or replace function public.get_platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select jsonb_build_object(
    'kullanici',         (select count(*) from public.profiles),
    'kart_goruntulenme', (select coalesce(sum(card_views), 0) from public.profiles),
    'nfc_kart',          (select coalesce(sum(nfc_cards_used), 0) from public.subscriptions)
  );
$fn$;

revoke all on function public.get_platform_stats() from public;
grant execute on function public.get_platform_stats() to anon, authenticated;

-- Kurumsal analitik — yönetici organizasyon üyelerinin toplamlarını görür
create or replace function public.get_org_member_analytics(org_id uuid)
returns table (profile_id uuid, name text, avatar_url text,
               qr_scans bigint, profile_views bigint, vcard_downloads bigint, link_clicks bigint)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if not public.is_admin_of_org(org_id) then
    return;
  end if;

  return query
  select p.id,
         coalesce(m.name, p.name),
         p.avatar_url,
         count(*) filter (where ae.event_type = 'qr_scan'),
         count(*) filter (where ae.event_type = 'profile_view'),
         count(*) filter (where ae.event_type = 'vcard_download'),
         count(*) filter (where ae.event_type = 'link_click')
    from public.members m
    join public.profiles p on p.id = m.profile_id
    left join public.analytics_events ae on ae.profile_id = p.id
   where m.organization_id = org_id
   group by p.id, m.name, p.name, p.avatar_url
   order by 4 desc;
end;
$fn$;

revoke all on function public.get_org_member_analytics(uuid) from public, anon;
grant execute on function public.get_org_member_analytics(uuid) to authenticated;
