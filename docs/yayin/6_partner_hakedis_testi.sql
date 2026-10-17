-- PARTNER HAK EDİŞİ TESTİ — 5_partner_hakedis_yuzde.sql'den SONRA çalıştırın.
--
-- KENDİNİ GERİ ALIR. Sonunda bilerek hata fırlatır; SQL Editor "ERROR: SONUC ..."
-- gösterir ve işlem geri döner. Oluşturduğu sahte davet, ödeme ve abonelik
-- değişikliği veritabanında KALMAZ. Hata mesajındaki JSON sonucu okuyun.
--
-- Ne doğruluyor:
--   1. Öğrenci planı artık hak ediş doğuruyor (eskiden kapı dışıydı).
--   2. Tutar %10 (49 ₺ → 4,90 ₺), sabit 50 ₺ değil.
--   3. Kart bedeli tabandan düşülüyor (Profesyonel yıllık + kart 1.839 ₺
--      ödenmiş olsa bile taban 1.590 ₺ → 159,00 ₺).
--   4. Aynı ödeme ikinci kez hak ediş doğurmuyor.
--   5. Ödeme niyeti olmadan (yönetici elle plan verirse) hak ediş doğmuyor.

do $t$
declare
  v_getiren   uuid;
  v_getirilen uuid;
  v_niyet1    uuid;
  v_niyet2    uuid;
  v_sonuc     jsonb;
  v_ogrenci   numeric;
  v_kartli    numeric;
  v_mukerrer  int;
  v_elle      int;
begin
  -- Ücretsiz planda iki profil seç (biri davet eden, biri davet edilen).
  select s.profile_id into v_getiren
    from public.subscriptions s where s.plan = 'free' order by s.created_at limit 1;
  select s.profile_id into v_getirilen
    from public.subscriptions s
   where s.plan = 'free' and s.profile_id <> v_getiren
   order by s.created_at limit 1;

  if v_getiren is null or v_getirilen is null then
    raise exception 'SONUC {"hata":"ucretsiz planda iki profil bulunamadi"}';
  end if;

  insert into public.referrals (referrer_id, referee_id, referral_code, status)
  values (v_getiren, v_getirilen, 'TEST-ORAN', 'pending');

  -- ---- 1 + 2: Öğrenci aylık 49 ₺ → beklenen 4,90 ₺ --------------------
  insert into public.payment_intents
    (user_id, profile_id, plan, period, with_nfc, amount_kurus, status, granted_at)
  select p.user_id, v_getirilen, 'student', 'monthly', false, 4900, 'odendi', now()
    from public.profiles p where p.id = v_getirilen
  returning id into v_niyet1;

  update public.subscriptions
     set plan = 'student', billing_cycle = 'monthly', status = 'active'
   where profile_id = v_getirilen;

  select amount into v_ogrenci
    from public.commissions where payment_intent_id = v_niyet1;

  -- ---- 4: aynı ödemeyi tekrar tetikle, ikinci satır OLUŞMAMALI ---------
  update public.subscriptions
     set plan = 'student', status = 'active', updated_at = now()
   where profile_id = v_getirilen;

  select count(*) into v_mukerrer
    from public.commissions where payment_intent_id = v_niyet1;

  -- ---- 3: Profesyonel yıllık + kart; taban kartsız fiyat olmalı --------
  insert into public.payment_intents
    (user_id, profile_id, plan, period, with_nfc, amount_kurus, status, granted_at)
  select p.user_id, v_getirilen, 'professional', 'yearly', true, 183900, 'odendi', now()
    from public.profiles p where p.id = v_getirilen
  returning id into v_niyet2;

  update public.subscriptions
     set plan = 'professional', billing_cycle = 'yearly', status = 'active'
   where profile_id = v_getirilen;

  select amount into v_kartli
    from public.commissions where payment_intent_id = v_niyet2;

  -- ---- 5: ödeme niyeti olmadan plan değişikliği (yönetici eli) ---------
  update public.payment_intents set granted_at = null
   where id in (v_niyet1, v_niyet2);

  update public.subscriptions
     set plan = 'business', billing_cycle = 'monthly', status = 'active'
   where profile_id = v_getirilen;

  select count(*) into v_elle
    from public.commissions where referral_id in
      (select id from public.referrals where referee_id = v_getirilen);

  v_sonuc := jsonb_build_object(
    '1_ogrenci_hak_edis_dogdu', v_ogrenci is not null,
    '2_ogrenci_tutar',          v_ogrenci,
    '2_beklenen',               4.90,
    '2_gecti',                  v_ogrenci = 4.90,
    '3_kartli_tutar',           v_kartli,
    '3_beklenen',               159.00,
    '3_kart_dusuldu',           v_kartli = 159.00,
    '4_mukerrer_satir',         v_mukerrer,
    '4_gecti',                  v_mukerrer = 1,
    '5_toplam_satir',           v_elle,
    '5_elle_plan_komisyon_yazmadi', v_elle = 2
  );

  raise exception 'SONUC %', v_sonuc::text;
end $t$;
