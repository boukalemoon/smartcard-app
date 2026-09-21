-- ============================================================================
-- PARTNER: GEÇERLİ PLAN SORGUSU (sunucudan sunucuya)
-- ============================================================================
--
-- SORUN (Arku tarafından bildirildi, 22.09.2026): QRtım planı partner
-- uygulamaya YALNIZCA giriş/bağlama anında yazılıyordu. Partner kendi
-- veritabanındaki satıra bakarak yetki veriyor ve o satır hiç tazelenmiyordu.
-- Sonuç: QRtım aboneliği BİTEN kullanıcı partner uygulamada ücretli kademede
-- SÜRESİZ kalıyor — planı tazelemek için yeniden QRtım'le giriş yapması
-- gerekiyor, ki yapmaz.
--
-- NEDEN ilgezdi_effective_plan() DESENİ BURADA ÇALIŞMAZ:
--   O fonksiyon auth.uid() kullanır, yani çağıranın QRtım OTURUMU olmasını
--   gerektirir. İlgezdi bu veritabanını paylaştığı için orada çalışıyor.
--   Arku'nun kendi veritabanı var ve ihtiyacı "girişten BAĞIMSIZ periyodik
--   tazeleme" — yani kullanıcı ortada yokken. Oturuma dayanan bir fonksiyon
--   tam da ihtiyaç duyulan anda çalışmaz.
--
-- KİMLİK: paylaşılan partner ana anahtarı DEĞİL, kullanıcı başına link_secret
--   (256 bit, partner_user_links'te bağlama anında üretiliyor). Bir sırrın
--   sızması yalnızca o kullanıcıyı etkiler; ana anahtar sızsa herkesin planı
--   okunurdu. Sırla yapılabilecek tek şey o kullanıcının planını okumaktır.
--
-- EN AZ VERİ: yalnızca plan, bitiş ve yetki bayrakları döner. Kimlik, e-posta
--   ve ad dönmez — bunlar bağlama anında zaten verildi.
--
-- NOT: qrtim_uid METİN DEĞİL UUID. İlk yazımda metin karşılaştırması yaptım
--   ve fonksiyon "operator does not exist: uuid = text" ile düştü; test ilk
--   çağrıda yakaladı. Biçim denetimi de UUID kalıbına göre yapılıyor ki
--   geçersiz değer cast hatası fırlatmadan elensin.

create or replace function public.partner_effective_plan(
  p_partner     text,
  p_qrtim_uid   text,
  p_link_secret text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid; v_prof uuid; v_plan text; v_bitis timestamptz;
  v_pf public.plan_features;
begin
  -- Yalnızca sunucu. İstemciden çağrılamaz (grant da yok).
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;

  if p_partner is null or p_partner !~ '^[a-z0-9_-]{2,32}$'
     or p_qrtim_uid is null
     or p_qrtim_uid !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_link_secret is null or p_link_secret !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_istek');
  end if;

  select q.user_id into v_user
    from public.qrtim_user_ids q where q.qrtim_uid = p_qrtim_uid::uuid;

  -- "Kullanıcı yok" ile "sır yanlış" AYNI cevabı döner: hangi kimliğin var
  -- olduğu sızmasın.
  if v_user is null or not exists (
       select 1 from public.partner_user_links l
        where l.user_id = v_user
          and l.partner = p_partner
          and l.link_secret = p_link_secret) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if not public.check_rate_limit('partner-plan:' || p_partner || ':' || v_user::text, 60, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  -- profiles.id ≠ user_id (34 profilin 7'sinde farklı) — doğru kolondan.
  select id into v_prof from public.profiles where user_id = v_user;

  select s.plan, s.expires_at into v_plan, v_bitis
    from public.subscriptions s
   where s.profile_id = v_prof
     and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc
   limit 1;

  v_plan := coalesce(v_plan, 'free');
  select * into v_pf from public.plan_features where plan = v_plan;

  update public.partner_user_links
     set last_seen = now()
   where user_id = v_user and partner = p_partner;

  perform public.log_event('partner.plan_checked', null, p_partner,
                           'subscription', v_prof::text, 'success', 'info', 'internal',
                           jsonb_build_object('plan', v_plan),
                           'service', null, null, null, v_user);

  return jsonb_build_object(
    'ok', true,
    'plan', v_plan,
    'expires_at', v_bitis,
    'max_sync_devices', coalesce(v_pf.sync_max_devices, 1),
    'password_sync', coalesce(v_pf.sync_passwords, false),
    'kontrol_zamani', now());
end;
$fn$;

revoke all on function public.partner_effective_plan(text, text, text) from public, anon, authenticated;
grant execute on function public.partner_effective_plan(text, text, text) to service_role;

comment on function public.partner_effective_plan(text, text, text) is
  'Partner uygulamanin SUNUCUSUNDAN cagirdigi gecerli plan sorgusu. Kimlik: kullanici basina link_secret. Oturum gerektirmez; periyodik tazeleme icin.';

-- DOĞRULANDI (geri alınan işlemde):
--   istemci çağıramıyor (42501) · doğru kimlikle plan dönüyor ·
--   yanlış sır "yetkisiz" · OLMAYAN kimlik de "yetkisiz" (numaralandırma yok) ·
--   başka partner adı "yetkisiz" · biçimsiz kimlik "gecersiz_istek" ·
--   ABONELİK BİTİNCE plan 'free'ye düşüyor (asıl düzeltilen davranış).
