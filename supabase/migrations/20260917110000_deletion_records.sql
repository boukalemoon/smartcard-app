-- >>> GEÇERSİZ KILINDI (20260917130000_retention_policy_and_fingerprints):
-- >>> Aşağıdaki sabit saklama süreleri kaldırıldı. Süreler artık
-- >>> data_retention_policies tablosunda, hukuki teyit gelene kadar BOŞ;
-- >>> boşken otomatik imha yapılmaz. Bu dosya uygulanmış geçmişi gösterir.
-- ============================================================================
-- SİLME KAYITLARI — KVKK imha kaydı
-- ============================================================================
--
-- ÖLÇÜM (17.09.2026):
--   • Supabase Auth kaydında (auth.audit_log_entries) 21 "user_deleted" olayı
--     var (9–24 Mart 2026, hepsi service_role = Supabase paneli). Bu kayıtlar
--     silinen kişinin TAM e-postasını ve telefonunu tutuyor.
--   • Bizim audit_log'umuzda yalnızca 1 silme kaydı var (mehmet, SQL ile).
--   • İki kaynak birbirini görmüyor: panelden silme bizim kaydımıza, SQL ile
--     silme Supabase kaydına düşmüyor.
--   • prune_audit_log(400) haftalık çalışıyor ve silme kayıtlarını da 400 gün
--     sonra siliyordu.
--
-- MEVZUAT (hukuk danışmanıyla teyit edilmeli):
--   Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi
--   Hakkında Yönetmelik md. 7/3: silme/yok etme/anonimleştirme işlemlerine
--   ilişkin kayıtlar en az ÜÇ YIL saklanır.
--
-- ÇÖZÜM:
--   1) Silme kaydı auth.users üzerindeki BEFORE DELETE tetikleyicisinden
--      yazılır: panel, Auth Admin API, yönetici paneli veya SQL — hangi yoldan
--      silinirse silinsin aynı kayıt, silinen/korunan kayıt sayılarıyla.
--   2) Saklama süresi eylem türüne göre: silme kayıtları 3 yıl, finansal ve
--      yönetici işlemleri 5 yıl, diğerleri 400 gün.
--   3) Supabase'deki 21 eski silme olayı maskelenerek kalıcı kayda aktarılır.
--   4) Kullanıcı talebiyle test verisi temizliği (50 TL "paid" test komisyonu).

-- ---------------------------------------------------------------------------
-- 1) Tek noktadan silme kaydı
-- ---------------------------------------------------------------------------

create or replace function public.auth_user_deletion_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_prof      uuid;
  v_gerekce   text := nullif(current_setting('qrtim.silme_gerekce', true), '');
  v_yapan     uuid := nullif(current_setting('qrtim.silme_yapan', true), '')::uuid;
  v_tur       text := coalesce(nullif(current_setting('qrtim.silme_yapan_turu', true), ''), 'service');
  v_zorla     boolean := coalesce(nullif(current_setting('qrtim.silme_zorlandi', true), '')::boolean, false);
  v_silinen   jsonb;
  v_korunan   jsonb;
begin
  select p.id into v_prof from public.profiles p where p.user_id = old.id;

  -- Silmeden ÖNCE say: CASCADE sonrası sayılamaz.
  v_silinen := jsonb_strip_nulls(jsonb_build_object(
    'profil',            (select count(*) from public.profiles where user_id = old.id),
    'profil_alanlari',   (select count(*) from public.profile_fields where profile_id = v_prof),
    'sosyal_baglanti',   (select count(*) from public.social_links where profile_id = v_prof),
    'uyelik',            (select count(*) from public.members where profile_id = v_prof),
    'abonelik',          (select count(*) from public.subscriptions where profile_id = v_prof),
    'analitik_olay',     (select count(*) from public.analytics_events where profile_id = v_prof),
    'senkron_verisi',    (select count(*) from public.user_sync_data where user_id = old.id),
    'tercih',            (select count(*) from public.user_preferences where user_id = old.id),
    'uygulama_baglantisi',(select count(*) from public.app_connections where user_id = old.id),
    'kurtarma_talebi',   (select count(*) from public.recovery_requests where user_id = old.id),
    'odeme_niyeti',      (select count(*) from public.payment_intents where user_id = old.id),
    'oturum',            (select count(*) from auth.sessions where user_id = old.id)
  ));

  -- Mevzuat gereği saklanan, ama kişiye bağı koparılan kayıtlar
  v_korunan := jsonb_build_object(
    'davet',             (select count(*) from public.referrals where referrer_id = v_prof or referee_id = v_prof),
    'komisyon',          (select count(*) from public.commissions where profile_id = v_prof),
    'kurum_komisyonu',   (select count(*) from public.organizational_commissions where profile_id = v_prof),
    'islem',             (select count(*) from public.transactions where profile_id = v_prof),
    'odeme_talebi',      (select count(*) from public.payment_requests where profile_id = v_prof),
    'depolama_dosyasi_kalan', (select count(*) from storage.objects where owner_id = old.id::text)
  );

  perform public.log_event(
    'account.deleted', v_yapan, 'qrtim', 'auth_user', old.id::text,
    'success', 'critical', 'internal',
    jsonb_build_object(
      'eposta_maskeli',  regexp_replace(coalesce(old.email, ''), '^(.).*(@.*)$', '\1***\2'),
      'hesap_acilis',    old.created_at,
      'gerekce',         coalesce(v_gerekce, 'Belirtilmedi (Supabase paneli veya Auth Admin API)'),
      'yol',             case when v_gerekce is null then 'supabase_panel_veya_api' else 'qrtim' end,
      'zorlandi',        v_zorla,
      'silinen',         v_silinen,
      'korunan_bagi_koparilan', v_korunan),
    v_tur, null, null, null, old.id);

  return old;
end;
$fn$;

revoke all on function public.auth_user_deletion_record() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted_record on auth.users;
create trigger on_auth_user_deleted_record
  before delete on auth.users
  for each row execute function public.auth_user_deletion_record();

-- Silme çekirdeği artık kendisi kayıt yazmaz; gerekçeyi işleme bırakır,
-- kaydı tetikleyici yazar (tek kaynak, çift kayıt yok).
create or replace function public.delete_user_account_internal(
  p_user_id    uuid,
  p_actor      uuid,
  p_actor_kind text,
  p_reason     text,
  p_force      boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_email  text;
  v_profil uuid;
  v_yetim  jsonb;
  v_dosya  int;
begin
  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    return jsonb_build_object('ok', false, 'hata', 'kullanici_bulunamadi');
  end if;

  select p.id into v_profil from public.profiles p where p.user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'ad', o.name)), '[]'::jsonb)
    into v_yetim
    from public.organizations o
   where exists (select 1 from public.members m
                  where m.organization_id = o.id and m.profile_id = v_profil and m.role = 'admin')
     and not exists (select 1 from public.members m
                      where m.organization_id = o.id and m.role = 'admin' and m.profile_id <> v_profil)
     and exists (select 1 from public.members m
                  where m.organization_id = o.id and m.profile_id is distinct from v_profil);

  if jsonb_array_length(v_yetim) > 0 and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'hata', 'sahipsiz_kalacak_organizasyon',
                              'organizasyonlar', v_yetim);
  end if;

  select count(*) into v_dosya from storage.objects so where so.owner_id = p_user_id::text;

  perform set_config('qrtim.silme_gerekce',     coalesce(p_reason, ''), true);
  perform set_config('qrtim.silme_yapan',       coalesce(p_actor::text, ''), true);
  perform set_config('qrtim.silme_yapan_turu',  coalesce(p_actor_kind, 'service'), true);
  perform set_config('qrtim.silme_zorlandi',    coalesce(p_force, false)::text, true);

  delete from auth.users where id = p_user_id;

  return jsonb_build_object('ok', true, 'kalan_dosya', v_dosya, 'sahipsiz_kalan_org', v_yetim);
end;
$fn$;

revoke all on function public.delete_user_account_internal(uuid,uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.delete_user_account_internal(uuid,uuid,text,text,boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2) Eylem türüne göre saklama süresi
-- ---------------------------------------------------------------------------

create or replace function public.audit_retention_days(p_action text)
returns int
language sql
immutable
set search_path = ''
as $fn$
  select case
    when p_action like 'account.%'                          then 1095  -- 3 yıl: imha kaydı
    when p_action like 'payment.%'
      or p_action like 'subscription.%'
      or p_action like 'referral.commission%'
      or p_action like 'admin.%'                            then 1825  -- 5 yıl
    when p_action like 'recovery.%'                         then 1095
    else 400
  end;
$fn$;

create or replace function public.prune_audit_log(p_keep_days int default 400)
returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_n int;
begin
  -- p_keep_days artık yalnızca "diğer" kayıtlar için alt sınır; türe özel
  -- süreler audit_retention_days'ten gelir.
  delete from public.audit_log a
   where a.occurred_at < now() - make_interval(days =>
           greatest(90, case when public.audit_retention_days(a.action) = 400
                             then coalesce(p_keep_days, 400)
                             else public.audit_retention_days(a.action) end));
  get diagnostics v_n = row_count;

  perform public.log_event('audit.prune', null, 'qrtim', 'audit_log', null,
                           'success', 'notice', 'internal',
                           jsonb_build_object('silinen', v_n, 'varsayilan_saklama_gun', p_keep_days),
                           'system');
  return v_n;
end;
$fn$;

revoke all on function public.prune_audit_log(int) from public, anon, authenticated;
grant execute on function public.prune_audit_log(int) to service_role;

-- ---------------------------------------------------------------------------
-- 3) Supabase Auth'taki eski silme olaylarını kalıcı kayda aktar (maskeli)
-- ---------------------------------------------------------------------------

insert into public.audit_log (occurred_at, actor_kind, actor_user_id, subject_user_id, app_key,
                              action, resource_type, resource_id, result, severity, visibility, meta)
select e.created_at,
       'service',
       null,
       nullif(e.payload->'traits'->>'user_id', '')::uuid,
       'qrtim',
       'account.deleted',
       'auth_user',
       e.payload->'traits'->>'user_id',
       'success', 'critical', 'internal',
       jsonb_build_object(
         'eposta_maskeli', regexp_replace(coalesce(e.payload->'traits'->>'user_email', ''), '^(.).*(@.*)$', '\1***\2'),
         'gerekce', 'Belirtilmedi (Supabase paneli)',
         'yol', 'supabase_panel_veya_api',
         'yapan', e.payload->>'actor_username',
         'kaynak', 'auth.audit_log_entries',
         'kaynak_olay_id', e.id)
  from auth.audit_log_entries e
 where e.payload->>'action' = 'user_deleted'
   and not exists (select 1 from public.audit_log a
                    where a.action = 'account.deleted'
                      and a.meta->>'kaynak_olay_id' = e.id::text);

-- ---------------------------------------------------------------------------
-- 4) Test verisi temizliği (kullanıcı talebi, 17.09.2026)
-- ---------------------------------------------------------------------------
-- Test hesabı mehmet@ahmet.com'un ödemesiz yükseltmesinden doğan 50 TL "paid"
-- komisyon ve ona bağlı davet kaydı (davetli hesabı silinmiş).

do $mig$
declare v_n int;
begin
  delete from public.commissions
   where id = '4777ad5b-c184-4ec5-a79d-453e4f998e02';
  get diagnostics v_n = row_count;

  if v_n > 0 then
    perform public.log_event('admin.test_data_removed', null, 'qrtim', 'commission',
                             '4777ad5b-c184-4ec5-a79d-453e4f998e02', 'success', 'critical', 'internal',
                             jsonb_build_object('tutar', 50, 'durum', 'paid',
                                                'gerekce', 'Kullanici talebi: odemesiz test yukseltmesinden dogan komisyon'),
                             'system');
  end if;

  delete from public.referrals
   where id = '8262b767-e735-4b94-a660-56a752032e57'
     and referee_id is null;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    perform public.log_event('admin.test_data_removed', null, 'qrtim', 'referral',
                             '8262b767-e735-4b94-a660-56a752032e57', 'success', 'notice', 'internal',
                             jsonb_build_object('gerekce', 'Silinmis test hesabina ait davet kaydi'),
                             'system');
  end if;
end
$mig$;
