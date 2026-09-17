-- ============================================================================
-- DAVET SİSTEMİ — çalışmıyordu ve saldırıya açıktı
-- ============================================================================
--
-- ÇALIŞMIYORDU:
--   Kayıt ekranı davet kodunu tarayıcıda saklıyor ama signUp çağrısına hiç
--   eklemiyor, sonra siliyordu. Davetle gelen kimse davet edene
--   bağlanmıyordu. Mevcut 2 davet kaydı Şubat'taki eski koddan kalma.
--
-- SALDIRIYA AÇIKTI:
--   • referrals: iki ayrı "herkes ekleyebilir" (WITH CHECK true) kuralı.
--     Biri kendini BAŞKASININ davet edeni olarak kaydedebilir; o kişi gerçek
--     ödeme yaptığında komisyon saldırgana yazılırdı.
--   • referrals: davet eden kendi kayıtlarının durumunu ve komisyon tutarını
--     güncelleyebiliyordu.
--   • referral_codes: herkes tüm kodları, sahiplerini ve kazançlarını
--     okuyabiliyordu; istemci sınırsız kod ekleyebiliyordu.
--
-- MÜKERRER KOD:
--   Profil başına tekillik kısıtı yok; "Kod oluştur" düğmesine her basış yeni
--   satır. hebe@lup.com'da 8 kod (hepsi 0 kullanım).
--
-- YENİ AKIŞ:
--   Davet kodu kayıt meta verisiyle gelir, davet kaydını SUNUCU oluşturur
--   (handle_new_user). İstemci davet yazamaz. Davet kaydı başarısız olsa bile
--   kayıt engellenmez; hata trigger_errors'a düşer.

-- ---------------------------------------------------------------------------
-- 1) Kodlar: tekilleştir, profil başına tek kod
-- ---------------------------------------------------------------------------

delete from public.referral_codes rc
 using (
   select id, row_number() over (partition by profile_id
                                 order by usage_count desc, created_at asc, id) as sira
     from public.referral_codes
 ) x
 where rc.id = x.id and x.sira > 1;

create unique index if not exists referral_codes_profile_tekil_idx
  on public.referral_codes (profile_id);

drop policy if exists "Users can insert own referral codes"    on public.referral_codes;
drop policy if exists "Anyone can read referral codes by code" on public.referral_codes;

drop policy if exists "yonetici davet kodlarini okur" on public.referral_codes;
create policy "yonetici davet kodlarini okur"
  on public.referral_codes for select to authenticated using (public.is_admin());

-- Bir davetli yalnızca bir kez davet edilmiş olabilir.
create unique index if not exists referrals_davetli_tekil_idx
  on public.referrals (referee_id) where referee_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Davet kayıtları: istemci yazamaz
-- ---------------------------------------------------------------------------

drop policy if exists "Anyone can insert referrals"        on public.referrals;
drop policy if exists "Anyone insert referrals"            on public.referrals;
drop policy if exists "Referrer can update own referrals"  on public.referrals;

-- ---------------------------------------------------------------------------
-- 3) Kod al / oluştur — idempotent
-- ---------------------------------------------------------------------------

create or replace function public.get_or_create_referral_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_prof   uuid := public.my_profile_id();
  v_satir  public.referral_codes;
  v_kod    text;
  v_taban  text;
  v_deneme int := 0;
begin
  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  select * into v_satir from public.referral_codes where profile_id = v_prof;

  if v_satir.id is null then
    select coalesce(nullif(p.referral_code, ''),
                    left(regexp_replace(lower(coalesce(p.username, 'qrtim')), '[^a-z0-9]', '', 'g'), 10)
                      || lpad(floor(random() * 10000)::int::text, 4, '0'))
      into v_kod
      from public.profiles p where p.id = v_prof;
    v_taban := left(regexp_replace(lower(v_kod), '[^a-z0-9]', '', 'g'), 10);

    loop
      begin
        insert into public.referral_codes (profile_id, code) values (v_prof, v_kod)
        returning * into v_satir;
        exit;
      exception when unique_violation then
        select * into v_satir from public.referral_codes where profile_id = v_prof;
        exit when v_satir.id is not null;       -- eşzamanlı istek oluşturmuş
        v_deneme := v_deneme + 1;
        if v_deneme > 10 then raise; end if;
        v_kod := coalesce(nullif(v_taban, ''), 'qrtim') || lpad(floor(random() * 10000)::int::text, 4, '0');
      end;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'id', v_satir.id, 'code', v_satir.code,
                            'usage_count', v_satir.usage_count,
                            'total_earnings', v_satir.total_earnings);
end;
$fn$;

revoke all on function public.get_or_create_referral_code() from public, anon;
grant execute on function public.get_or_create_referral_code() to authenticated;

-- Davet ettiklerim — davetlinin yalnızca adı (e-posta değil)
create or replace function public.my_referrals()
returns table (id uuid, davetli_adi text, status text, commission_amount numeric,
               created_at timestamptz, completed_at timestamptz, hesap_silinmis boolean)
language sql
stable
security definer
set search_path = ''
as $fn$
  select r.id,
         coalesce(nullif(p.name, ''), 'QRtım kullanıcısı'),
         r.status, r.commission_amount, r.created_at, r.completed_at,
         r.referee_id is null
    from public.referrals r
    left join public.profiles p on p.id = r.referee_id
   where r.referrer_id = public.my_profile_id()
   order by r.created_at desc;
$fn$;

revoke all on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Kayıt tetikleyicisi daveti oluşturur
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_username text;
  v_name     text;
  v_local    text;
  v_ref_kod  text;
  v_referrer uuid;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );

  -- ÖNCE küçült, SONRA temizle
  v_local := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]', '', 'g');
  v_username := coalesce(nullif(v_local, ''), 'kullanici')
                || '_' || substring(new.id::text, 1, 6);

  -- Davet kodu (kayıt meta verisinden). Bulunamazsa sessizce yok sayılır:
  -- yanlış kod kaydı engellememeli.
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
      -- Davet kaydı başarısız olsa bile kullanıcı kaydı TAMAMLANIR.
      insert into public.trigger_errors (source, context, sqlstate, message)
      values ('handle_new_user.referral',
              jsonb_build_object('user_id', new.id, 'kod', v_ref_kod), sqlstate, sqlerrm);
    end;
  end if;

  return new;
exception when others then
  insert into public.trigger_errors (source, context, sqlstate, message)
  values ('handle_new_user', jsonb_build_object('user_id', new.id), sqlstate, sqlerrm);
  return new;
end;
$fn$;
