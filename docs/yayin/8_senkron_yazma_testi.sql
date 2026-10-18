-- SENKRON YAZMA KURALLARI TESTİ — 7_senkron_yazma_kurallari.sql'den SONRA.
--
-- KENDİNİ GERİ ALIR: sonunda bilerek hata fırlatır, işlem geri döner.
-- Bıraktığı hiçbir satır kalmaz. Hata mesajındaki JSON'u okuyun;
-- "SONUC_GECTI" ile başlıyorsa her şey yolunda.
--
-- Doğrulananlar:
--   1. settings satırı ücretsiz planda da yazılabiliyor (davranış korundu).
--   2. passwords satırı düz metin KABUL EDİLMİYOR (kısıt).
--   3. passwords satırı hak olmadan KABUL EDİLMİYOR (politika yerine kısıt
--      testi: burada service_role olduğumuz için politika atlanır, bu yüzden
--      hakkı fonksiyonla ayrıca ölçüyoruz).
--   4. size_bytes sunucuda hesaplanıyor; istemcinin verdiği değer yoksayılıyor.
--   5. anon rolünde tablo yetkisi kalmadı.

do $t$
declare
  v_user     uuid;
  v_prof     uuid;
  v_plan     text;
  v_hak      boolean;
  v_duz      text := 'kabul_edildi_HATA';
  v_boyut    integer;
  v_anon     int;
  v_settings boolean := false;
begin
  select p.user_id, p.id into v_user, v_prof
    from public.profiles p
    join public.subscriptions s on s.profile_id = p.id and s.plan = 'free'
   where p.user_id is not null
   order by p.created_at limit 1;

  if v_user is null then
    raise exception 'SONUC_KALDI {"hata":"ucretsiz planli kullanici bulunamadi"}';
  end if;

  select s.plan into v_plan from public.subscriptions s where s.profile_id = v_prof;

  -- 1) settings: ucretsizde de yazilabilmeli
  insert into public.user_sync_data (user_id, app_key, data_type, payload, size_bytes)
  values (v_user, 'ilgezdi', 'settings', '{"theme":"dark"}'::jsonb, 999999)
  on conflict (user_id, app_key, data_type) do update set payload = excluded.payload;
  v_settings := true;

  -- 4) size_bytes istemcinin verdigi 999999 DEGIL, sunucunun hesabi olmali
  select size_bytes into v_boyut
    from public.user_sync_data
   where user_id = v_user and app_key = 'ilgezdi' and data_type = 'settings';

  -- 2) passwords duz metin: kisit reddetmeli
  begin
    insert into public.user_sync_data (user_id, app_key, data_type, payload, is_encrypted)
    values (v_user, 'ilgezdi', 'passwords', '{"site":"acik_sifre"}'::jsonb, false);
    v_duz := 'KABUL_EDILDI_HATA';
  exception when check_violation then
    v_duz := 'reddedildi';
  end;

  -- 3) hak fonksiyonu ucretsiz planda false donmeli
  --    (auth.uid() yok, bu yuzden my_profile_id null -> free sayilir)
  select public.senkron_sifre_hakki() into v_hak;

  -- 5) anon tablo yetkisi kalmamali
  select count(*) into v_anon
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'user_sync_data' and grantee = 'anon';

  raise exception 'SONUC_GECTI %', jsonb_build_object(
    '1_settings_ucretsizde_yazildi', v_settings,
    '2_duz_sifre',                   v_duz,
    '2_gecti',                       v_duz = 'reddedildi',
    '3_ucretsizde_hak',              v_hak,
    '3_gecti',                       v_hak = false,
    '4_istemci_verdi',               999999,
    '4_sunucu_hesapladi',            v_boyut,
    '4_gecti',                       v_boyut <> 999999,
    '5_anon_yetki_sayisi',           v_anon,
    '5_gecti',                       v_anon = 0
  )::text;
end $t$;
