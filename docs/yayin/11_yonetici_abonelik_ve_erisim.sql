-- ============================================================================
-- Platform yönetici paneli: abonelik süresi zorunlu, erişim engelleme
-- ============================================================================
--
-- 1) SÜRESİZ ÜCRETLİ PLAN HATASI — canlıda ZATEN OLDU.
--    admin_set_plan şöyle yazıyordu:
--      expires_at = case when p_plan = 'free' then null
--                        else coalesce(p_expires_at, expires_at) end
--    Panel (KullaniciPaneli.jsx) p_expires_at'i HİÇ GÖNDERMİYOR. Ücretsiz
--    kullanıcının expires_at'i null olduğu için, yöneticinin verdiği ücretli
--    plan null bitişle kaydoluyor. my_plan_limits ise
--    "expires_at is null or expires_at > now()" diyor: yani SONSUZA KADAR
--    geçerli. Ölçüm (18.10.2026): 1 adet professional satırı expires_at null.
--    Artık ücretli plan BİTİŞ TARİHİ OLMADAN kaydedilmiyor.
--
-- 2) ERİŞİM ENGELLEME yoktu. auth.users.banned_until GoTrue'nun kendi
--    mekanizması: yeni belirteç ve yenileme reddedilir. Kendi kolonumuzu
--    açıp uygulama kodunda her yerde kontrol etmeye çalışmaktansa kimlik
--    katmanının kendi aracını kullanıyoruz.
--
--    SINIR, BİLEREK YAZILIYOR: engelleme ANINDA oturumu kesmez. JWT
--    durumsuzdur; elindeki erişim belirteci süresi dolana kadar (varsayılan
--    1 saat) çalışmaya devam eder. Bu yüzden engellerken kişinin
--    auth.sessions satırları da silinir: yenileme yapamaz, en fazla bir
--    belirteç ömrü kadar erişimi sürer.
--
-- 3) Panel engelli kişiyi görebilsin diye okuma ucu. profiles'a denormalize
--    bir "engelli" kolonu AÇILMADI: depoda ayrışan kopya yüzünden yaşanan
--    sorunların aynısını doğurur (bkz. arku-link'teki plan notu).

-- ---------------------------------------------------------------------------
-- 1) Abonelik: ücretli plan bitiş tarihi ister
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_plan(
  p_profile_id uuid,
  p_plan       text,
  p_expires_at timestamptz default null,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eski        public.subscriptions;
  v_n           int;
  v_hedef_user  uuid;
  v_bitis       timestamptz;
begin
  if not public.is_admin() then
    perform public.log_event('admin.set_plan', auth.uid(), 'qrtim', 'subscription',
                             p_profile_id::text, 'denied', 'critical', 'internal',
                             jsonb_build_object('istenen_plan', p_plan));
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if p_plan not in ('free','student','professional','stk','business','corporate') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_plan');
  end if;

  select * into v_eski from public.subscriptions s where s.profile_id = p_profile_id;
  select p.user_id into v_hedef_user from public.profiles p where p.id = p_profile_id;

  -- Ücretsizde bitiş yok. Ücretlide ya yeni tarih gelir ya mevcut tarih
  -- GEÇERLİ olur; ikisi de yoksa kayıt yapılmaz (süresiz plan oluşmasın).
  v_bitis := case when p_plan = 'free' then null
                  else coalesce(p_expires_at, v_eski.expires_at) end;

  if p_plan <> 'free' and (v_bitis is null or v_bitis <= now()) then
    return jsonb_build_object('ok', false, 'hata', 'bitis_tarihi_gerekli');
  end if;

  update public.subscriptions
     set plan = p_plan,
         status = 'active',
         expires_at = v_bitis,
         updated_at = now()
   where profile_id = p_profile_id;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'hata', 'abonelik_bulunamadi');
  end if;

  perform public.log_event('admin.set_plan', auth.uid(), 'qrtim', 'subscription',
                           p_profile_id::text, 'success', 'critical', 'user',
                           jsonb_build_object('eski_plan', v_eski.plan, 'yeni_plan', p_plan,
                                              'eski_bitis', v_eski.expires_at,
                                              'yeni_bitis', v_bitis,
                                              'gerekce', p_reason),
                           null, null, null, null, v_hedef_user);

  return jsonb_build_object('ok', true, 'eski_plan', v_eski.plan,
                            'yeni_plan', p_plan, 'bitis', v_bitis);
end;
$$;

comment on function public.admin_set_plan(uuid,text,timestamptz,text) is
  'Yonetici plan atar. UCRETLI PLAN BITIS TARIHI ZORUNLU: tarihsiz cagri bitis_tarihi_gerekli doner (suresiz ucretli plan olusmasin).';

-- ---------------------------------------------------------------------------
-- 2) Erişim engelleme
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_access(
  p_profile_id uuid,
  p_engelli    boolean,
  p_until      timestamptz default null,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid;
  v_rol    text;
  v_ben    uuid := auth.uid();
  v_bitis  timestamptz;
  v_n      int;
  v_oturum int := 0;
begin
  if not public.is_admin() then
    perform public.log_event('admin.set_access', v_ben, 'qrtim', 'user',
                             p_profile_id::text, 'denied', 'critical', 'internal',
                             jsonb_build_object('istenen', p_engelli));
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  select p.user_id, p.role into v_user, v_rol
    from public.profiles p where p.id = p_profile_id;

  if v_user is null then
    return jsonb_build_object('ok', false, 'hata', 'kullanici_bulunamadi');
  end if;

  -- Kendini engellemek paneli kilitler: tek yönetici var, geri alacak kimse
  -- kalmaz.
  if v_user = v_ben then
    return jsonb_build_object('ok', false, 'hata', 'kendini_engelleyemezsin');
  end if;

  -- Yönetici yöneticiyi engellemez: iki yönetici birbirini kilitleyebilirdi.
  -- Rol önce admin_set_role ile düşürülür, sonra engellenir.
  if v_rol in ('admin', 'superadmin') then
    return jsonb_build_object('ok', false, 'hata', 'yonetici_engellenemez');
  end if;

  if p_engelli then
    -- Süre verilmediyse kalıcı. 'infinity' yazmıyoruz: bazı istemciler
    -- sonsuz zaman damgasını JSON'a çeviremiyor.
    v_bitis := coalesce(p_until, now() + interval '100 years');
    if v_bitis <= now() then
      return jsonb_build_object('ok', false, 'hata', 'gecersiz_tarih');
    end if;
  else
    v_bitis := null;
  end if;

  update auth.users set banned_until = v_bitis where id = v_user;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'hata', 'kullanici_bulunamadi');
  end if;

  -- Engellerken oturumları da sil: banned_until yalnız YENİ belirteci ve
  -- yenilemeyi engelliyor, elindeki erişim belirteci süresi dolana kadar
  -- çalışır. Oturum satırı silinince yenileme de yapamaz.
  if p_engelli then
    delete from auth.sessions where user_id = v_user;
    get diagnostics v_oturum = row_count;
  end if;

  perform public.log_event('admin.set_access', v_ben, 'qrtim', 'user',
                           p_profile_id::text, 'success', 'critical', 'user',
                           jsonb_build_object('engelli', p_engelli, 'bitis', v_bitis,
                                              'kapatilan_oturum', v_oturum,
                                              'gerekce', p_reason),
                           null, null, null, null, v_user);

  return jsonb_build_object('ok', true, 'engelli', p_engelli, 'bitis', v_bitis,
                            'kapatilan_oturum', v_oturum);
end;
$$;

revoke all on function public.admin_set_access(uuid,boolean,timestamptz,text) from public, anon;
grant execute on function public.admin_set_access(uuid,boolean,timestamptz,text) to authenticated;

comment on function public.admin_set_access(uuid,boolean,timestamptz,text) is
  'Yonetici erisimi engeller/acar (auth.users.banned_until). Kendini ve diger yoneticileri engelleyemez. Engellerken oturumlar silinir.';

-- ---------------------------------------------------------------------------
-- 3) Panelin okuduğu engelli listesi
-- ---------------------------------------------------------------------------
-- profile_id → banned_until eşlemesi. Yönetici değilse boş nesne döner;
-- auth.users istemciye hiç açılmıyor.
create or replace function public.admin_blocked_users()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_admin() then
    coalesce((
      select jsonb_object_agg(p.id::text, u.banned_until)
        from auth.users u
        join public.profiles p on p.user_id = u.id
       where u.banned_until is not null and u.banned_until > now()
    ), '{}'::jsonb)
  else '{}'::jsonb end;
$$;

revoke all on function public.admin_blocked_users() from public, anon;
grant execute on function public.admin_blocked_users() to authenticated;

comment on function public.admin_blocked_users() is
  'Engelli hesaplar: profile_id -> banned_until. Yonetici degilse bos. auth.users istemciye acilmaz.';
