-- ============================================================================
-- DIŞ DENETİM DÜZELTMELERİ (21.09.2026)
-- ============================================================================
--
-- Üç bağımsız denetim (veritabanı yüzeyi, sunucu kodu, istemci) çalıştırıldı.
-- Aşağıdakiler kanıtlanmış bulguların karşılığı. Her biri canlıda denendi.

-- ---------------------------------------------------------------------------
-- 1) KRİTİK: istemci kendi IP'sini uyduruyordu — TÜM IP hız sınırları etkisiz
-- ---------------------------------------------------------------------------
-- request_client_ip() x-forwarded-for'un İLK elemanını alıyordu. Vekiller
-- istemcinin gönderdiği başlığı KORUYUP gerçek IP'yi SONA ekler; ilk eleman
-- saldırganın yazdığıdır.
--
-- CANLI KANIT (üretime uydurma başlıkla iki istek):
--   X-Forwarded-For: 9.9.9.9          -> kova "card:9.9.9.9"
--   X-Forwarded-For: 7.7.7.7, 1.2.3.4 -> kova "card:7.7.7.7"
--   Başlık veritabanına "9.9.9.9,31.223.77.23" olarak ulaşıyordu: uydurma
--   değer başta, GERÇEK IP sonda.
--   Sonuç: her istekte farklı değer yazan biri IP'ye dayanan hiçbir sınıra
--   takılmıyordu — kart görüntüleme, olay kaydı, randevu, kişi defteri,
--   takvim beslemesi, özel alan adı çözümleme, hepsi.
--
-- DOĞRU KAYNAK: cf-connecting-ip. Cloudflare bu başlığı kendi yazar ve
--   taklidine izin VERMEZ: denedim, isteği 403 (error code 1000) ile
--   tamamen reddetti.
--
-- DÜZELTME SONRASI DOĞRULAMA: üç farklı uydurma IP ile yapılan üç çağrının
--   üçü de tek kovaya, gerçek IP'ye düştü (hits=3).
create or replace function public.request_client_ip()
returns text language sql stable set search_path = '' as $fn$
  with h as (select current_setting('request.headers', true)::json as j),
  ham as (
    select
      nullif(btrim(coalesce((select j->>'cf-connecting-ip' from h), '')), '') as cf,
      nullif(btrim(coalesce(
        (select (string_to_array(j->>'x-forwarded-for', ','))[
                  array_length(string_to_array(j->>'x-forwarded-for', ','), 1)]
           from h), '')), '') as xff_son
  )
  select coalesce(
    (select v from (select coalesce(cf, xff_son) as v from ham) t
      where v ~ '^[0-9a-fA-F:.]{3,45}$'),
    'bilinmeyen')
  from ham limit 1;
$fn$;

revoke all on function public.request_client_ip() from public, anon, authenticated;

comment on function public.request_client_ip() is
  'Gercek istemci IP si. cf-connecting-ip taklit edilemez; x-forwarded-for''un ILK elemani ISTEMCININ yazdigidir, kullanilmaz.';

-- ---------------------------------------------------------------------------
-- 2) Boş saat üretimi: iç yol ayrıldı, hız sınırı ve tavan eklendi
-- ---------------------------------------------------------------------------
-- appointment_slots anon'a açıktı ve hiç hız sınırı yoktu. Ayarlarda gün
-- başına çok sayıda aralık tanımlayan biri tek anonim çağrıyla saniyelerce
-- veritabanı işlemcisi harcatabiliyordu (denetim ölçtü: 6 KB ayarla 19,7 sn).
-- book_appointment içeride bu fonksiyonu çağırdığı için sınırı doğrudan
-- eklemek kişinin kendi randevusunu alırken kendi sınırını yemesine yol
-- açardı; iç yol ayrıldı ve istemciye kapatıldı.
create or replace function public.appointment_slots_internal(
  p_profile uuid, p_gun date
) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_ayar public.appointment_settings;
  v_gun date := coalesce(p_gun, (now() at time zone 'Europe/Istanbul')::date);
  v_dow text; v_araliklar jsonb; v_aralik jsonb;
  v_bas timestamptz; v_bit timestamptz; v_imlec timestamptz;
  v_slotlar jsonb := '[]'::jsonb; v_en_erken timestamptz; v_son_gun date;
  v_adet int := 0;
begin
  if p_profile is null then return jsonb_build_object('ok', false, 'hata', 'kart_bulunamadi'); end if;

  select * into v_ayar from public.appointment_settings where profile_id = p_profile;
  if v_ayar.profile_id is null or not v_ayar.aktif then
    return jsonb_build_object('ok', false, 'hata', 'randevu_kapali');
  end if;

  v_en_erken := now() + make_interval(hours => v_ayar.en_erken_saat);
  v_son_gun  := (now() at time zone 'Europe/Istanbul')::date + v_ayar.ileri_gun;
  if v_gun > v_son_gun or v_gun < (now() at time zone 'Europe/Istanbul')::date then
    return jsonb_build_object('ok', true, 'gun', v_gun, 'slotlar', '[]'::jsonb);
  end if;

  v_dow := extract(isodow from v_gun)::text;
  v_araliklar := v_ayar.gun_saatleri -> v_dow;
  if v_araliklar is null or jsonb_typeof(v_araliklar) <> 'array' then
    return jsonb_build_object('ok', true, 'gun', v_gun, 'slotlar', '[]'::jsonb);
  end if;

  for v_aralik in select * from jsonb_array_elements(v_araliklar) loop
    exit when v_adet >= 200;
    continue when jsonb_typeof(v_aralik) <> 'array' or jsonb_array_length(v_aralik) <> 2;
    begin
      v_bas := ((v_gun::text || ' ' || (v_aralik->>0))::timestamp) at time zone 'Europe/Istanbul';
      v_bit := ((v_gun::text || ' ' || (v_aralik->>1))::timestamp) at time zone 'Europe/Istanbul';
    exception when others then
      continue;
    end;

    v_imlec := v_bas;
    while v_imlec + make_interval(mins => v_ayar.slot_dakika) <= v_bit loop
      exit when v_adet >= 200;
      if v_imlec >= v_en_erken
         and not exists (
           select 1 from public.appointments a
            where a.profile_id = p_profile
              and a.durum in ('bekliyor','onaylandi')
              and tstzrange(a.baslar_at, a.biter_at)
                  && tstzrange(v_imlec, v_imlec + make_interval(mins => v_ayar.slot_dakika))
         ) then
        v_slotlar := v_slotlar || to_jsonb(v_imlec);
        v_adet := v_adet + 1;
      end if;
      v_imlec := v_imlec + make_interval(mins => v_ayar.slot_dakika);
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'gun', v_gun,
                            'slot_dakika', v_ayar.slot_dakika,
                            'aciklama', v_ayar.aciklama,
                            'otomatik_onay', v_ayar.otomatik_onay,
                            'slotlar', v_slotlar);
end;
$fn$;

revoke all on function public.appointment_slots_internal(uuid, date) from public, anon, authenticated;

create or replace function public.appointment_slots(
  p_code text default null, p_username text default null, p_gun date default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare v_prof uuid;
begin
  if not public.check_rate_limit('slot:' || public.request_client_ip(), 120, 600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  if p_code is not null and length(p_code) <= 40 then
    select r.profil_id into v_prof from public.resolve_card_code(p_code) r;
  elsif p_username is not null and length(p_username) <= 100 then
    select id into v_prof from public.profiles where username = p_username;
  end if;
  if v_prof is null then return jsonb_build_object('ok', false, 'hata', 'kart_bulunamadi'); end if;

  return public.appointment_slots_internal(v_prof, p_gun);
end;
$fn$;

revoke all on function public.appointment_slots(text, text, date) from public;
grant execute on function public.appointment_slots(text, text, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Ayar kaydı: aralık SAYISI da sınırlandı
-- ---------------------------------------------------------------------------
-- Biçim doğrulanıyordu ama sayı doğrulanmıyordu: gün başına 500 örtüşen
-- aralık kaydedilip yukarıdaki üretim bombaya çevrilebiliyordu.
create or replace function public.appointment_settings_save(
  p_aktif boolean, p_slot_dakika int, p_ileri_gun int, p_en_erken_saat int,
  p_gun_saatleri jsonb, p_aciklama text, p_otomatik_onay boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_prof uuid := public.my_profile_id(); v_gun jsonb := '{}'::jsonb; k text; v jsonb;
begin
  if v_prof is null then return jsonb_build_object('ok', false, 'hata', 'profil_yok'); end if;
  if coalesce(p_slot_dakika, 30) not in (15,20,30,45,60,90,120) then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_slot');
  end if;

  for k, v in select * from jsonb_each(coalesce(p_gun_saatleri, '{}'::jsonb)) loop
    continue when k !~ '^[1-7]$' or jsonb_typeof(v) <> 'array';
    declare v_temiz jsonb := '[]'::jsonb; a jsonb;
    begin
      for a in select * from jsonb_array_elements(v) loop
        -- Bir günde en çok 4 çalışma aralığı: gerçek bir takvimde bundan
        -- fazlası yok; fazlası yalnızca üretimi pahalılaştırmaya yarar.
        exit when jsonb_array_length(v_temiz) >= 4;
        continue when jsonb_typeof(a) <> 'array' or jsonb_array_length(a) <> 2;
        continue when (a->>0) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                   or (a->>1) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
        continue when (a->>1) <= (a->>0);
        v_temiz := v_temiz || jsonb_build_array(jsonb_build_array(a->>0, a->>1));
      end loop;
      if jsonb_array_length(v_temiz) > 0 then
        v_gun := v_gun || jsonb_build_object(k, v_temiz);
      end if;
    end;
  end loop;

  insert into public.appointment_settings
    (profile_id, aktif, slot_dakika, ileri_gun, en_erken_saat, gun_saatleri, aciklama, otomatik_onay)
  values (v_prof, coalesce(p_aktif,false), coalesce(p_slot_dakika,30),
          least(greatest(coalesce(p_ileri_gun,14),1),180),
          least(greatest(coalesce(p_en_erken_saat,2),0),168),
          v_gun, nullif(left(btrim(coalesce(p_aciklama,'')),300),''),
          coalesce(p_otomatik_onay,false))
  on conflict (profile_id) do update
    set aktif = excluded.aktif, slot_dakika = excluded.slot_dakika,
        ileri_gun = excluded.ileri_gun, en_erken_saat = excluded.en_erken_saat,
        gun_saatleri = excluded.gun_saatleri, aciklama = excluded.aciklama,
        otomatik_onay = excluded.otomatik_onay, updated_at = now();

  return jsonb_build_object('ok', true, 'gun_saatleri', v_gun);
end;
$fn$;

revoke all on function public.appointment_settings_save(boolean,int,int,int,jsonb,text,boolean) from public, anon;
grant execute on function public.appointment_settings_save(boolean,int,int,int,jsonb,text,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) book_appointment: iki kusur
-- ---------------------------------------------------------------------------
-- (a) KOVA REDDEDİLEN İSTEKLE DE YANIYORDU. Kart başına günlük sınır, saat
--     doğrulanmadan ÖNCE tüketiliyordu: 30 GEÇERSİZ istek hiç randevu
--     oluşturmadan esnafın günlük kotasını doldurup gerçek müşterilere
--     'kart_dolu' dedirtiyordu. Artık kovaya değil GERÇEKTEN OLUŞMUŞ randevu
--     sayısına bakılıyor. (Test: 35 geçersiz istek → 0 randevu, gerçek
--     müşteri hâlâ giriyor.)
-- (b) KONTROL KARAKTERLERİ TEMİZLENMİYORDU. Ad ve açıklama ICS dosyasına
--     yazılıyor; yalın CR bazı takvimlerde satır sonu sayılıyor ve kimliksiz
--     biri kart sahibinin takvimine sahte kayıt/alarm düşürebiliyordu.
create or replace function public.book_appointment(
  p_code text default null, p_username text default null,
  p_baslar timestamptz default null, p_ad text default null,
  p_eposta text default null, p_telefon text default null,
  p_aciklama text default null, p_kaynak text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
  v_prof uuid; v_persona uuid; v_ayar public.appointment_settings;
  v_ip text := public.request_client_ip(); v_id uuid; v_kod text;
  v_ad text := left(btrim(regexp_replace(coalesce(p_ad, ''), '[\u0000-\u001F\u007F]', '', 'g')), 80);
  v_not text := left(btrim(regexp_replace(coalesce(p_aciklama, ''), '[\u0000-\u001F\u007F]', '', 'g')), 500);
  v_eposta text := nullif(lower(btrim(coalesce(p_eposta, ''))), '');
  v_tel text := nullif(regexp_replace(coalesce(p_telefon, ''), '[^0-9+]', '', 'g'), '');
  v_kaynak text := lower(nullif(btrim(coalesce(p_kaynak, '')), ''));
  v_biter timestamptz; v_sahibi uuid; v_bugunku int;
begin
  if v_kaynak is not null and v_kaynak not in ('qr','nfc','link','direct') then
    v_kaynak := null;
  end if;

  if p_code is not null and length(p_code) <= 40 then
    select r.profil_id, r.persona_id into v_prof, v_persona from public.resolve_card_code(p_code) r;
  elsif p_username is not null and length(p_username) <= 100 then
    select id into v_prof from public.profiles where username = p_username;
    if v_prof is not null then
      select id into v_persona from public.personas where profile_id = v_prof and is_primary;
    end if;
  end if;
  if v_prof is null then return jsonb_build_object('ok', false, 'hata', 'kart_bulunamadi'); end if;

  select * into v_ayar from public.appointment_settings where profile_id = v_prof;
  if v_ayar.profile_id is null or not v_ayar.aktif then
    return jsonb_build_object('ok', false, 'hata', 'randevu_kapali');
  end if;

  if char_length(v_ad) < 2 then return jsonb_build_object('ok', false, 'hata', 'ad_gerekli'); end if;
  if v_eposta is null and v_tel is null then
    return jsonb_build_object('ok', false, 'hata', 'iletisim_gerekli');
  end if;
  if v_eposta is not null and v_eposta !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_eposta');
  end if;
  if p_baslar is null then return jsonb_build_object('ok', false, 'hata', 'saat_gerekli'); end if;

  if p_baslar < now() + make_interval(hours => v_ayar.en_erken_saat) then
    return jsonb_build_object('ok', false, 'hata', 'cok_yakin');
  end if;
  if p_baslar::date > (now() at time zone 'Europe/Istanbul')::date + v_ayar.ileri_gun then
    return jsonb_build_object('ok', false, 'hata', 'cok_ileri');
  end if;

  if not public.check_rate_limit('randevu:' || v_ip, 5, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  select count(*) into v_bugunku
    from public.appointments a
   where a.profile_id = v_prof
     and a.created_at > now() - interval '1 day'
     and a.durum in ('bekliyor','onaylandi');
  if v_bugunku >= 30 then
    return jsonb_build_object('ok', false, 'hata', 'kart_dolu');
  end if;

  v_biter := p_baslar + make_interval(mins => v_ayar.slot_dakika);

  if not exists (
    select 1 from jsonb_array_elements_text(
           (public.appointment_slots_internal(
              v_prof, (p_baslar at time zone 'Europe/Istanbul')::date))->'slotlar') s
     where s::timestamptz = p_baslar) then
    return jsonb_build_object('ok', false, 'hata', 'saat_uygun_degil');
  end if;

  begin
    insert into public.appointments
      (profile_id, persona_id, baslar_at, biter_at, ad, eposta, telefon, aciklama, kaynak, durum)
    values (v_prof, v_persona, p_baslar, v_biter, v_ad, v_eposta, v_tel,
            nullif(v_not, ''), v_kaynak,
            case when v_ayar.otomatik_onay then 'onaylandi' else 'bekliyor' end)
    returning id, iptal_kodu into v_id, v_kod;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'hata', 'saat_dolu');
  end;

  select user_id into v_sahibi from public.profiles where id = v_prof;
  perform public.log_event('appointment.booked', null, 'qrtim', 'appointment', v_id::text,
                           'success', 'notice', 'user',
                           jsonb_build_object('kaynak', v_kaynak),
                           'service', null, null, null, v_sahibi);

  return jsonb_build_object('ok', true, 'id', v_id, 'iptal_kodu', v_kod,
                            'durum', case when v_ayar.otomatik_onay then 'onaylandi' else 'bekliyor' end,
                            'baslar_at', p_baslar, 'biter_at', v_biter);
end;
$fn$;

revoke all on function public.book_appointment(text,text,timestamptz,text,text,text,text,text) from public;
grant execute on function public.book_appointment(text,text,timestamptz,text,text,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Takvim beslemesi: sınır anahtar doğrulandıktan SONRA ve KİŞİ başına
-- ---------------------------------------------------------------------------
-- Eski hali iki yönden bozuktu:
--   • Sınır, anahtarın geçerliliğine bakılmadan tüketiliyordu: biçimi doğru
--     ama uydurma anahtarlarla 61 istek TÜM abonelerin beslemesini kapatıyordu.
--   • Kova IP'ye bağlıydı ama beslemeyi ziyaretçi değil Vercel çağırıyor;
--     dünyadaki bütün aboneler tek kovayı paylaşıyordu. Google ve Outlook
--     saatlik yokladığı için sistem saldırı olmadan kendini kapatırdı.
-- Anahtar 128 bit, tahmin edilemez; sınırın işi kaba kuvvet değil, tek bir
-- aboneliğin aşırı yoklamasını dizginlemek.
create or replace function public.appointment_calendar_feed(p_anahtar text)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_prof uuid; v_ad text; v_liste jsonb;
begin
  if p_anahtar is null or p_anahtar !~ '^[0-9a-f]{32}$' then return null; end if;

  select s.profile_id into v_prof
    from public.appointment_settings s
   where s.takvim_anahtari = p_anahtar;
  if v_prof is null then return null; end if;

  if not public.check_rate_limit('takvim:' || v_prof::text, 120, 3600) then return null; end if;

  select p.name into v_ad from public.profiles p where p.id = v_prof;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'baslar_at', a.baslar_at, 'biter_at', a.biter_at,
           'ad', a.ad, 'eposta', a.eposta, 'telefon', a.telefon,
           'aciklama', a.aciklama, 'kaynak', a.kaynak, 'durum', a.durum,
           'created_at', a.created_at) order by a.baslar_at), '[]'::jsonb)
    into v_liste
    from public.appointments a
   where a.profile_id = v_prof and a.baslar_at > now() - interval '30 days';

  return jsonb_build_object('ok', true, 'kart_sahibi', v_ad, 'randevular', v_liste);
end;
$fn$;

revoke all on function public.appointment_calendar_feed(text) from public;
grant execute on function public.appointment_calendar_feed(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Özel alan adı yaşam döngüsü
-- ---------------------------------------------------------------------------
-- (a) KANIT ÖLDÜ AMA YAYIN SÜRÜYORDU: resolve_custom_domain yalnızca elle
--     iptale bakıyordu. Süresi dolan ya da 'basarisiz'e düşen doğrulamada
--     kartta rozet kayboluyor, kart o alan adında yayında kalıyordu.
--     Gerçekçi senaryo: çalışan şirket DNS'ine erişimi varken alt alan adını
--     bağlar, işten ayrılır, BT kaydı siler — kişisel kart şirketin alan
--     adında süresiz asılı kalırdı.
-- (b) SÜRESİ GEÇMİŞ KANITLA YENİ ADRES BAĞLANABİLİYORDU.
-- (c) KALICI KİLİTLENME: kaldırılan adres 'iptal' satırı olarak kalıyor,
--     host UNIQUE; talep akışı bunu da çakışma sayıyordu. Alan adı el
--     değiştirse ve yeni sahip usulünce doğrulasa bile kalıcı olarak
--     'adres_kullanimda' alıyor, üstelik sebebi kimse göremiyordu.
-- (d) YENİDEN TALEPTE KANIT TAZELENMİYORDU: adres bağlanıyor ama eski
--     kanıta bağlı kaldığı için sessizce hiç açılmıyordu.
-- (e) ADET SINIRI YOKTU: tek ucuz alan adını doğrulayan biri sınırsız alt
--     alan adı bağlayıp paylaşılan barındırma projesinin sertifika kotasını
--     tüketebilirdi.
create or replace function public.resolve_custom_domain(p_host text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_host text := public.normalize_domain(p_host); v_d public.custom_domains; v_persona uuid;
begin
  if v_host is null or length(v_host) > 253 then return null; end if;
  if not public.check_rate_limit('ozelkart:' || public.request_client_ip(), 120, 600) then
    raise exception 'Cok fazla istek. Lutfen biraz bekleyin.' using errcode = '53400';
  end if;

  select * into v_d from public.custom_domains where host = v_host and durum = 'baglandi';
  if v_d.id is null then return null; end if;

  -- Kanıt CANLI olmalı: iptal edilmemiş, hâlâ doğrulanmış, süresi geçmemiş.
  if not exists (
    select 1 from public.identity_verifications v
     where v.id = v_d.dogrulama_id
       and v.iptal_at is null
       and v.durum = 'dogrulandi'
       and (v.gecerlilik_bitis is null or v.gecerlilik_bitis > now())
  ) then
    return null;
  end if;

  v_persona := v_d.persona_id;
  if v_persona is null then
    select id into v_persona from public.personas where profile_id = v_d.profile_id and is_primary;
  end if;
  if v_persona is null then return null; end if;

  return public.build_public_card(v_d.profile_id, v_persona);
end;
$fn$;

revoke all on function public.resolve_custom_domain(text) from public;
grant execute on function public.resolve_custom_domain(text) to anon, authenticated;

create or replace function public.custom_domain_claim(
  p_host text, p_persona_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
  v_prof uuid := public.my_profile_id();
  v_host text := public.normalize_domain(p_host);
  v_dog  public.identity_verifications;
  v_id   uuid; v_var public.custom_domains; v_adet int;
begin
  if v_prof is null then return jsonb_build_object('ok', false, 'hata', 'profil_yok'); end if;
  if not public.is_valid_domain(v_host) then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_alan_adi');
  end if;
  if not public.check_rate_limit('ozel-alan:' || v_prof::text, 10, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  select * into v_dog
    from public.identity_verifications v
   where v.profile_id = v_prof
     and v.tur = 'alan_adi' and v.durum = 'dogrulandi' and v.iptal_at is null
     and (v.gecerlilik_bitis is null or v.gecerlilik_bitis > now())
     and (v_host = v.konu or v_host like '%.' || v.konu)
   order by char_length(v.konu) desc limit 1;

  if v_dog.id is null then
    return jsonb_build_object('ok', false, 'hata', 'alan_adi_dogrulanmamis');
  end if;

  if p_persona_id is not null and not exists (
       select 1 from public.personas where id = p_persona_id and profile_id = v_prof) then
    return jsonb_build_object('ok', false, 'hata', 'kart_yok');
  end if;

  select count(*) into v_adet from public.custom_domains
   where profile_id = v_prof and durum <> 'iptal';
  if v_adet >= 5 and not exists (select 1 from public.custom_domains
                                  where host = v_host and profile_id = v_prof) then
    return jsonb_build_object('ok', false, 'hata', 'adres_siniri');
  end if;

  select * into v_var from public.custom_domains where host = v_host;
  if v_var.id is not null then
    if v_var.profile_id <> v_prof and v_var.durum <> 'iptal' then
      return jsonb_build_object('ok', false, 'hata', 'adres_kullanimda');
    end if;
    update public.custom_domains
       set persona_id = p_persona_id, profile_id = v_prof,
           dogrulama_id = v_dog.id, durum = 'beklemede', updated_at = now()
     where id = v_var.id;
    v_id := v_var.id;
  else
    insert into public.custom_domains (profile_id, persona_id, host, dogrulama_id)
    values (v_prof, p_persona_id, v_host, v_dog.id)
    returning id into v_id;
  end if;

  perform public.log_event('custom_domain.claimed', auth.uid(), 'qrtim',
                           'custom_domain', v_id::text, 'success', 'notice', 'user',
                           jsonb_build_object('host', v_host),
                           'user', null, public.request_client_ip(), null, auth.uid());

  return jsonb_build_object('ok', true, 'id', v_id, 'host', v_host,
                            'kayit_turu', 'CNAME', 'kayit_hedefi', 'cname.vercel-dns.com');
end;
$fn$;

revoke all on function public.custom_domain_claim(text, uuid) from public, anon;
grant execute on function public.custom_domain_claim(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Geçici DNS arızası rozeti düşürüyordu
-- ---------------------------------------------------------------------------
-- verification_mark sonucu koşulsuz yazıyordu: tek başarısız yoklama geçerli
-- bir doğrulamayı 'basarisiz'e çeviriyor, rozeti kartından düşürüyor ve o
-- alan adıyla yeni adres bağlamayı engelliyordu. DNS bir dakikalığına cevap
-- vermese bu yaşanırdı. Artık başarısız yoklama GEÇERLİ bir doğrulamayı
-- düşürmüyor; doğrulamayı bitiren tek şey süresinin dolması.
create or replace function public.verification_mark(
  p_id uuid, p_ok boolean, p_kanit jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_var public.identity_verifications; v_sahip uuid; v_gecerli boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;
  select * into v_var from public.identity_verifications where id = p_id;
  if v_var.id is null or v_var.iptal_at is not null then
    return jsonb_build_object('ok', false, 'hata', 'kayit_yok');
  end if;
  if v_var.deneme_sayisi >= 50 then
    return jsonb_build_object('ok', false, 'hata', 'deneme_siniri');
  end if;

  v_gecerli := v_var.durum = 'dogrulandi'
               and (v_var.gecerlilik_bitis is null or v_var.gecerlilik_bitis > now());

  update public.identity_verifications
     set durum = case when p_ok then 'dogrulandi'
                      when v_gecerli then durum
                      else 'basarisiz' end,
         dogrulandi_at    = case when p_ok then now() else dogrulandi_at end,
         gecerlilik_bitis = case when p_ok then now() + interval '180 days' else gecerlilik_bitis end,
         kanit            = coalesce(p_kanit, '{}'::jsonb),
         deneme_sayisi    = deneme_sayisi + 1,
         son_deneme_at    = now(),
         updated_at       = now()
   where id = p_id;

  select user_id into v_sahip from public.profiles where id = v_var.profile_id;

  perform public.log_event(
    case when p_ok then 'verification.succeeded' else 'verification.failed' end,
    null, 'qrtim', 'identity_verification', p_id::text,
    case when p_ok then 'success' else 'failure' end,
    case when p_ok then 'notice' else 'warning' end, 'user',
    jsonb_build_object('tur', v_var.tur, 'konu', v_var.konu, 'gecerli_kaldi', v_gecerli and not p_ok),
    'service', null, null, null, v_sahip);

  return jsonb_build_object('ok', true,
    'durum', case when p_ok then 'dogrulandi' when v_gecerli then v_var.durum else 'basarisiz' end);
end;
$fn$;

revoke all on function public.verification_mark(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.verification_mark(uuid, boolean, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 8) Kalan tablo yetkileri
-- ---------------------------------------------------------------------------
-- 20260921180000 göçü select/insert/update/delete kaldırmıştı ama Supabase'in
-- varsayılan GRANT ALL'undan gelen TRUNCATE, TRIGGER, REFERENCES duruyordu.
-- TRUNCATE satır güvenliğini tamamen yok sayar. Bugün sömürülebilir değil
-- (PostgREST TRUNCATE fiili sunmuyor, roller doğrudan bağlanamıyor) ama o
-- göçün amacı zaten "ileride biri hata yaparsa kapı açık kalmasın"dı.
revoke truncate, references, trigger on
  public.identity_verifications, public.custom_domains, public.appointments,
  public.appointment_settings, public.card_contacts, public.rate_limit_hits,
  public.commission_rates
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- DOĞRULANDI (geri alınan işlemde, düzeltmelerden sonra):
--   A: günde 10 aralık gönderildi → 4'e indirildi
--   B: 35 geçersiz randevu isteği → 0 randevu, gerçek müşteri hâlâ girebiliyor
--   C: başarısız yoklama sonrası doğrulama hâlâ 'dogrulandi'
--   D: kanıt süresi dolunca özel alan adı yayını durdu
--   E: süresi geçmiş kanıtla yeni adres talebi reddedildi
--   F: iptal edilen adres yeniden bağlanabiliyor (kalıcı kilitlenme yok)
-- ---------------------------------------------------------------------------
