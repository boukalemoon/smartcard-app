-- ============================================================================
-- SAKLAMA POLİTİKASI (veri) + YENİDEN KAYIT DOĞRULAMA İZİ
-- ============================================================================
--
-- 1) SAKLAMA SÜRELERİ KODDA DEĞİL, POLİTİKA TABLOSUNDA
--    Kullanıcı kararı (17.09.2026): "Saklama sürelerini belirtmeyelim, yasanın
--    belirlediği yönetmeliklere uygun şekilde düzenleyelim."
--    Önceki sürümde süreler fonksiyonun içine sabit yazılmıştı. Artık her kayıt
--    türünün süresi ve hukuki dayanağı data_retention_policies tablosunda.
--    Süre alanı hukuki teyit gelene kadar BOŞ; boşken hiçbir kayıt
--    kendiliğinden silinmez (erken imha, geç imhadan daha geri döndürülemez).
--
-- 2) SİLİNEN HESABIN KOPYASI TUTULMAZ — YALNIZCA GERİ DÖNDÜRÜLEMEZ İZ
--    İstenen: tam silme talebinde veri QRtım'dan silinsin ama arka planda
--    kopyası tutulsun; aynı kişi yeniden kayıt olursa saldırı mı gerçek kişi
--    mi teyit edilebilsin.
--    Tam kopya bu hâliyle YAPILMADI: KVKK md. 3'e göre kaydetme ve muhafaza
--    etme de "işleme"dir; silme talebinden sonra kopyayı saklayıp "silindi"
--    demek silme yükümlülüğünü ihlal eder ve ilgili kişiyi yanıltır.
--    Aynı amaç, ölçülülük ilkesine uygun şekilde şöyle karşılanır:
--      • Ad, profil, içerik TUTULMAZ.
--      • Normalize edilmiş e-posta ve telefonun, Supabase Vault'taki gizli
--        anahtarla üretilmiş HMAC özeti tutulur. Özetten e-posta geri
--        elde edilemez; yalnızca "aynı kimlik mi" sorusu cevaplanabilir.
--      • Yeniden kayıtta eşleşme olursa kayıt ENGELLENMEZ; güvenlik kaydına
--        düşer, doğrulama insan kararıdır.
--    Dayanak: KVKK md. 5/2(f) meşru menfaat (kötüye kullanım önleme).
--    Aydınlatma metninde açıklanmalıdır (bu sürümde eklendi).

-- ===========================================================================
-- 1) Saklama politikası
-- ===========================================================================

create table if not exists public.data_retention_policies (
  key             text primary key,
  description     text not null,
  legal_basis     text,
  action_patterns text[] not null default '{}',
  retention_days  int,
  confirmed       boolean not null default false,
  confirmed_by    text,
  confirmed_at    timestamptz,
  updated_at      timestamptz not null default now(),
  constraint data_retention_days_chk check (retention_days is null or retention_days >= 1),
  -- Süre girilebilir ama yalnızca teyit edilmiş olarak.
  constraint data_retention_confirmed_chk check (retention_days is null or confirmed)
);

comment on table public.data_retention_policies is
  'Kayıt türü başına saklama süresi ve hukuki dayanağı. Süre boşsa otomatik imha yapılmaz. Süreler hukuki teyitle girilir.';

alter table public.data_retention_policies enable row level security;
-- Politika yok: yalnızca service_role / yönetim.

insert into public.data_retention_policies (key, description, legal_basis, action_patterns) values
  ('imha_kayitlari',
   'Hesap silme ve kişisel veri imha işlemlerine ilişkin kayıtlar',
   'KVKK md. 7; Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik',
   '{account.delete%}'),
  ('finansal_ve_yonetim_kayitlari',
   'Ödeme, abonelik, komisyon ve yönetici işlemlerine ilişkin kayıtlar',
   'Vergi ve ticaret mevzuatındaki defter/belge saklama yükümlülükleri (hukuki teyit gerekli)',
   '{payment.%,subscription.%,referral.commission%,admin.%}'),
  ('hesap_kurtarma_kayitlari',
   'Hesap kurtarma talepleri ve onayları',
   'KVKK md. 5/2(f) meşru menfaat — hesap güvenliği',
   '{recovery.%}'),
  ('yeniden_kayit_izi',
   'Silinmiş hesaplara ait geri döndürülemez kimlik özeti (account_fingerprints)',
   'KVKK md. 5/2(f) meşru menfaat — kötüye kullanım ve dolandırıcılık önleme',
   '{account.reregistration%}'),
  ('genel_islem_kayitlari',
   'Diğer tüm denetim kayıtları',
   'KVKK md. 4 — amaçla sınırlı ve ölçülü saklama; erişim kayıtlarına ilişkin mevzuat kapsamı değerlendirilmeli',
   '{%}')
on conflict (key) do nothing;

-- Eylem → en özgül desenle eşleşen politikanın süresi (NULL = imha yok)
create or replace function public.audit_retention_days(p_action text)
returns int
language sql
stable
security definer
set search_path = ''
as $fn$
  select p.retention_days
    from public.data_retention_policies p, unnest(p.action_patterns) d
   where p_action like d
   order by length(d) desc
   limit 1;
$fn$;

revoke all on function public.audit_retention_days(text) from public, anon, authenticated;

create or replace function public.prune_audit_log(p_keep_days int default null)
returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_n int; v_iz int; v_iz_gun int;
begin
  -- p_keep_days artık kullanılmıyor (geriye uyumluluk için imzada duruyor).
  -- Yalnızca süresi TEYİT EDİLMİŞ politikalar imha edilir.
  delete from public.audit_log a
   where public.audit_retention_days(a.action) is not null
     and a.occurred_at < now() - make_interval(days => greatest(90, public.audit_retention_days(a.action)));
  get diagnostics v_n = row_count;

  select retention_days into v_iz_gun from public.data_retention_policies where key = 'yeniden_kayit_izi';
  v_iz := 0;
  if v_iz_gun is not null then
    delete from public.account_fingerprints where deleted_at < now() - make_interval(days => v_iz_gun);
    get diagnostics v_iz = row_count;
  end if;

  if v_n > 0 or v_iz > 0 then
    perform public.log_event('audit.prune', null, 'qrtim', 'audit_log', null,
                             'success', 'notice', 'internal',
                             jsonb_build_object('silinen_kayit', v_n, 'silinen_iz', v_iz), 'system');
  end if;
  return v_n;
end;
$fn$;

revoke all on function public.prune_audit_log(int) from public, anon, authenticated;
grant execute on function public.prune_audit_log(int) to service_role;

-- Zamanlanmış iş artık sabit gün sayısı geçmiyor.
select cron.alter_job(j.jobid, command => 'select public.prune_audit_log()')
  from cron.job j where j.jobname = 'qrtim-denetim-saklama';

-- ===========================================================================
-- 2) Geri döndürülemez kimlik izi
-- ===========================================================================

-- Gizli anahtar veritabanı tablosunda değil, Supabase Vault'ta şifreli durur.
do $mig$
begin
  if not exists (select 1 from vault.secrets where name = 'qrtim_fingerprint_pepper') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
                                'qrtim_fingerprint_pepper',
                                'Silinmiş hesap kimlik özeti (HMAC) anahtarı. Değiştirilirse eski izler eşleşmez.');
  end if;
end
$mig$;

create table if not exists public.account_fingerprints (
  id                    bigint generated always as identity primary key,
  email_hmac            text,
  phone_hmac            text,
  deleted_at            timestamptz not null default now(),
  reason_category       text not null default 'bilinmiyor',
  abuse_flag            boolean not null default false,
  account_created_month date,
  constraint account_fingerprints_iz_chk check (email_hmac is not null or phone_hmac is not null),
  constraint account_fingerprints_kategori_chk
    check (reason_category in ('kullanici_talebi','yonetici','kotuye_kullanim','bilinmiyor'))
);

comment on table public.account_fingerprints is
  'Silinmiş hesapların geri döndürülemez kimlik özeti. Ad/profil/içerik YOK. Yalnızca yeniden kayıt doğrulaması için.';
comment on column public.account_fingerprints.account_created_month is
  'Kesin tarih değil, ay hassasiyeti (veri minimizasyonu).';

create index if not exists account_fingerprints_email_idx on public.account_fingerprints (email_hmac) where email_hmac is not null;
create index if not exists account_fingerprints_phone_idx on public.account_fingerprints (phone_hmac) where phone_hmac is not null;

alter table public.account_fingerprints enable row level security;
-- Politika yok: yalnızca service_role.

create or replace function public.identity_fingerprint(p_value text, p_kind text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v_anahtar text; v_norm text; v_yerel text; v_alan text;
begin
  if p_value is null or btrim(p_value) = '' then return null; end if;

  select ds.decrypted_secret into v_anahtar
    from vault.decrypted_secrets ds where ds.name = 'qrtim_fingerprint_pepper' limit 1;
  if v_anahtar is null then return null; end if;

  if p_kind = 'email' then
    v_norm  := lower(btrim(p_value));
    v_yerel := split_part(split_part(v_norm, '@', 1), '+', 1);   -- ahmet+deneme → ahmet
    v_alan  := split_part(v_norm, '@', 2);
    if v_alan in ('gmail.com', 'googlemail.com') then             -- a.hmet@gmail → ahmet@gmail
      v_yerel := replace(v_yerel, '.', '');
      v_alan  := 'gmail.com';
    end if;
    if v_yerel = '' or v_alan = '' then return null; end if;
    v_norm := v_yerel || '@' || v_alan;
  elsif p_kind = 'phone' then
    v_norm := regexp_replace(p_value, '[^0-9]', '', 'g');
    if length(v_norm) = 11 and left(v_norm, 1) = '0' then v_norm := '9' || v_norm; end if;  -- 05xx → 905xx
    if length(v_norm) = 10 then v_norm := '90' || v_norm; end if;                          -- 5xx  → 905xx
    if length(v_norm) < 10 then return null; end if;
  else
    return null;
  end if;

  return encode(extensions.hmac(p_kind || ':' || v_norm, v_anahtar, 'sha256'), 'hex');
end;
$fn$;

revoke all on function public.identity_fingerprint(text, text) from public, anon, authenticated;

-- ===========================================================================
-- 3) Silme kaydı: iz bırak (test hesapları hariç)
-- ===========================================================================

create or replace function public.auth_user_deletion_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_prof     uuid;
  v_gerekce  text := nullif(current_setting('qrtim.silme_gerekce', true), '');
  v_yapan    uuid := nullif(current_setting('qrtim.silme_yapan', true), '')::uuid;
  v_tur      text := coalesce(nullif(current_setting('qrtim.silme_yapan_turu', true), ''), 'service');
  v_zorla    boolean := coalesce(nullif(current_setting('qrtim.silme_zorlandi', true), '')::boolean, false);
  v_kategori text := nullif(current_setting('qrtim.silme_kategori', true), '');
  v_silinen  jsonb;
  v_korunan  jsonb;
  v_email_iz text;
  v_tel_iz   text;
begin
  select p.id into v_prof from public.profiles p where p.user_id = old.id;

  v_silinen := jsonb_strip_nulls(jsonb_build_object(
    'profil',             (select count(*) from public.profiles where user_id = old.id),
    'profil_kimlikleri',  (select count(*) from public.personas where profile_id = v_prof),
    'profil_alanlari',    (select count(*) from public.profile_fields where profile_id = v_prof),
    'sosyal_baglanti',    (select count(*) from public.social_links where profile_id = v_prof),
    'uyelik',             (select count(*) from public.members where profile_id = v_prof),
    'abonelik',           (select count(*) from public.subscriptions where profile_id = v_prof),
    'analitik_olay',      (select count(*) from public.analytics_events where profile_id = v_prof),
    'senkron_verisi',     (select count(*) from public.user_sync_data where user_id = old.id),
    'tercih',             (select count(*) from public.user_preferences where user_id = old.id),
    'uygulama_baglantisi',(select count(*) from public.app_connections where user_id = old.id),
    'kurtarma_talebi',    (select count(*) from public.recovery_requests where user_id = old.id),
    'odeme_niyeti',       (select count(*) from public.payment_intents where user_id = old.id),
    'oturum',             (select count(*) from auth.sessions where user_id = old.id)
  ));

  v_korunan := jsonb_build_object(
    'davet',            (select count(*) from public.referrals where referrer_id = v_prof or referee_id = v_prof),
    'komisyon',         (select count(*) from public.commissions where profile_id = v_prof),
    'kurum_komisyonu',  (select count(*) from public.organizational_commissions where profile_id = v_prof),
    'islem',            (select count(*) from public.transactions where profile_id = v_prof),
    'odeme_talebi',     (select count(*) from public.payment_requests where profile_id = v_prof),
    'depolama_dosyasi_kalan', (select count(*) from storage.objects where owner_id = old.id::text)
  );

  v_kategori := coalesce(v_kategori, case when v_gerekce is null then 'bilinmiyor' else 'kullanici_talebi' end);

  -- Yeniden kayıt doğrulama izi — test hesapları için bırakılmaz.
  if v_kategori <> 'test' then
    v_email_iz := public.identity_fingerprint(old.email, 'email');
    v_tel_iz   := public.identity_fingerprint(old.phone, 'phone');
    if v_email_iz is not null or v_tel_iz is not null then
      insert into public.account_fingerprints (email_hmac, phone_hmac, reason_category, abuse_flag, account_created_month)
      values (v_email_iz, v_tel_iz, v_kategori, v_kategori = 'kotuye_kullanim',
              date_trunc('month', old.created_at)::date);
    end if;
  end if;

  perform public.log_event(
    'account.deleted', v_yapan, 'qrtim', 'auth_user', old.id::text,
    'success', 'critical', 'internal',
    jsonb_build_object(
      'eposta_maskeli',  regexp_replace(coalesce(old.email, ''), '^(.).*(@.*)$', '\1***\2'),
      'hesap_acilis',    old.created_at,
      'gerekce',         coalesce(v_gerekce, 'Belirtilmedi (Supabase paneli veya Auth Admin API)'),
      'yol',             case when v_gerekce is null then 'supabase_panel_veya_api' else 'qrtim' end,
      'kategori',        v_kategori,
      'zorlandi',        v_zorla,
      'iz_birakildi',    v_kategori <> 'test' and (v_email_iz is not null or v_tel_iz is not null),
      'silinen',         v_silinen,
      'korunan_bagi_koparilan', v_korunan),
    v_tur, null, null, null, old.id);

  return old;
end;
$fn$;

revoke all on function public.auth_user_deletion_record() from public, anon, authenticated;

-- Silme çekirdeği: kategori parametresi
drop function if exists public.delete_user_account_internal(uuid, uuid, text, text, boolean);

create or replace function public.delete_user_account_internal(
  p_user_id    uuid,
  p_actor      uuid,
  p_actor_kind text,
  p_reason     text,
  p_force      boolean default false,
  p_category   text default 'kullanici_talebi'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_email text; v_profil uuid; v_yetim jsonb; v_dosya int;
begin
  if p_category not in ('kullanici_talebi','yonetici','kotuye_kullanim','test') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_kategori');
  end if;

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
    return jsonb_build_object('ok', false, 'hata', 'sahipsiz_kalacak_organizasyon', 'organizasyonlar', v_yetim);
  end if;

  select count(*) into v_dosya from storage.objects so where so.owner_id = p_user_id::text;

  perform set_config('qrtim.silme_gerekce',    coalesce(p_reason, ''), true);
  perform set_config('qrtim.silme_yapan',      coalesce(p_actor::text, ''), true);
  perform set_config('qrtim.silme_yapan_turu', coalesce(p_actor_kind, 'service'), true);
  perform set_config('qrtim.silme_zorlandi',   coalesce(p_force, false)::text, true);
  perform set_config('qrtim.silme_kategori',   p_category, true);

  delete from auth.users where id = p_user_id;

  return jsonb_build_object('ok', true, 'kalan_dosya', v_dosya, 'sahipsiz_kalan_org', v_yetim);
end;
$fn$;

revoke all on function public.delete_user_account_internal(uuid,uuid,text,text,boolean,text)
  from public, anon, authenticated;
grant execute on function public.delete_user_account_internal(uuid,uuid,text,text,boolean,text)
  to service_role;

-- Yönetici silme: kötüye kullanım işareti
drop function if exists public.admin_delete_user(uuid, text, boolean);

create or replace function public.admin_delete_user(
  p_user_id         uuid,
  p_reason          text,
  p_force           boolean default false,
  p_kotuye_kullanim boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_hedef_rol text;
begin
  if not public.is_admin() then
    perform public.log_event('account.delete_attempt', auth.uid(), 'qrtim', 'auth_user',
                             p_user_id::text, 'denied', 'critical', 'internal',
                             jsonb_build_object('sebep', 'yonetici_degil'));
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;
  if p_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'hata', 'kendini_silemezsin');
  end if;
  select p.role into v_hedef_rol from public.profiles p where p.user_id = p_user_id;
  if v_hedef_rol in ('admin', 'superadmin') then
    return jsonb_build_object('ok', false, 'hata', 'yonetici_silinemez',
                              'bilgi', 'Önce yönetici yetkisini kaldırın.');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'hata', 'gerekce_zorunlu');
  end if;

  return public.delete_user_account_internal(
    p_user_id, auth.uid(), 'user', p_reason, p_force,
    case when coalesce(p_kotuye_kullanim, false) then 'kotuye_kullanim' else 'yonetici' end);
end;
$fn$;

revoke all on function public.admin_delete_user(uuid,text,boolean,boolean) from public, anon;
grant execute on function public.admin_delete_user(uuid,text,boolean,boolean) to authenticated;

-- ===========================================================================
-- 4) Yeniden kayıtta iz kontrolü (engellemez, işaretler)
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_username text; v_name text; v_local text; v_ref_kod text; v_referrer uuid;
  v_iz public.account_fingerprints;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));

  v_local := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]', '', 'g');
  v_username := coalesce(nullif(v_local, ''), 'kullanici') || '_' || substring(new.id::text, 1, 6);

  v_ref_kod := left(nullif(btrim(new.raw_user_meta_data->>'referral_code'), ''), 40);
  if v_ref_kod is not null then
    select rc.profile_id into v_referrer
      from public.referral_codes rc where lower(rc.code) = lower(v_ref_kod) limit 1;
    if v_referrer is null then
      select p.id into v_referrer
        from public.profiles p where lower(p.referral_code) = lower(v_ref_kod) limit 1;
    end if;
  end if;

  insert into public.profiles as pr (id, user_id, email, name, username, referred_by)
  values (new.id, new.id, new.email, v_name, v_username, v_referrer)
  on conflict (id) do update
    set user_id = excluded.user_id,
        email   = excluded.email,
        name    = case when pr.name = '' or pr.name is null then excluded.name else pr.name end;

  if v_referrer is not null and v_referrer <> new.id then
    begin
      insert into public.referrals (referrer_id, referee_id, referral_code, status)
      values (v_referrer, new.id, v_ref_kod, 'pending');

      update public.referral_codes
         set usage_count = coalesce(usage_count, 0) + 1
       where profile_id = v_referrer;

      perform public.log_event('referral.created', null, 'qrtim', 'referral', new.id::text,
                               'success', 'info', 'internal',
                               jsonb_build_object('kod', v_ref_kod), 'system',
                               null, null, null, new.id);
    exception when others then
      insert into public.trigger_errors (source, context, sqlstate, message)
      values ('handle_new_user.referral',
              jsonb_build_object('user_id', new.id, 'kod', v_ref_kod), sqlstate, sqlerrm);
    end;
  end if;

  -- Daha önce silinmiş bir kimlik mi? Kaydı ENGELLEMEZ; yalnızca güvenlik
  -- kaydına düşer. Karar insan tarafından verilir.
  begin
    select f.* into v_iz
      from public.account_fingerprints f
     where f.email_hmac = public.identity_fingerprint(new.email, 'email')
        or (new.phone is not null and f.phone_hmac = public.identity_fingerprint(new.phone, 'phone'))
     order by f.abuse_flag desc, f.deleted_at desc
     limit 1;

    if v_iz.id is not null then
      perform public.log_event('account.reregistration_detected', null, 'qrtim', 'auth_user', new.id::text,
                               'success',
                               case when v_iz.abuse_flag then 'critical' else 'notice' end,
                               'internal',
                               jsonb_build_object('onceki_silinme', v_iz.deleted_at::date,
                                                  'onceki_kategori', v_iz.reason_category,
                                                  'kotuye_kullanim_gecmisi', v_iz.abuse_flag),
                               'system', null, null, null, new.id);
    end if;
  exception when others then
    insert into public.trigger_errors (source, context, sqlstate, message)
    values ('handle_new_user.fingerprint', jsonb_build_object('user_id', new.id), sqlstate, sqlerrm);
  end;

  return new;
exception when others then
  insert into public.trigger_errors (source, context, sqlstate, message)
  values ('handle_new_user', jsonb_build_object('user_id', new.id), sqlstate, sqlerrm);
  return new;
end;
$fn$;

-- ===========================================================================
-- 5) İstemci rolleri bu tablolara hiç dokunamaz (RLS'e ek katman)
-- ===========================================================================
revoke all on table public.data_retention_policies from anon, authenticated;
revoke all on table public.account_fingerprints    from anon, authenticated;
