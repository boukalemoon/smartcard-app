-- ============================================================================
-- KULLANICI ADI ÜRETİMİNDE SIRA HATASI
-- ============================================================================
--
-- Adım 1'in testleri sırasında yakalandı. Mevcut ifade:
--
--   lower(regexp_replace(split_part(email,'@',1), '[^a-z0-9]', '', 'g'))
--
-- `regexp_replace` ÖNCE çalışıyor ve `[^a-z0-9]` sınıfı büyük harfleri de
-- eşleştirip siliyor; `lower()` ancak ondan sonra uygulanıyor. Yani e-posta
-- adresinde büyük harf olan herkesin kullanıcı adı bozuluyordu:
--
--   AHMET@ornek.com              -> ''                  (kullanıcı adı "_999999")
--   Zeynep.Kaya@ornek.com        -> 'eynepaya'
--   BURAK123@ornek.com           -> '123'
--   MEHMET.demir+etiket@ornek.com-> 'demiretiket'
--
-- Kullanıcı adı olmadan kartvizit sayfası (/card/:username) açılamaz, yani
-- bu sessizce kartı olmayan kullanıcılar üretiyordu.
--
-- Düzeltme: önce lower(), sonra regexp. Ayrıca yerel kısım tamamen
-- simgelerden oluşuyorsa kullanıcı adı boş kalmasın diye yedek ad.
--
-- Doğrulandı (geri alınan işlemde, dört uç durum):
--   AHMET@...        -> ahmet_999999
--   Zeynep.Kaya@...  -> zeynepkaya_999999
--   MEHMET.demir+... -> mehmetdemiretiket_999999
--   +++@...          -> kullanici_999999

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_username text;
  v_name     text;
  v_local    text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );

  -- ÖNCE küçült, SONRA temizle
  v_local := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]', '', 'g');
  v_username := coalesce(nullif(v_local, ''), 'kullanici')
                || '_' || substring(new.id::text, 1, 6);

  insert into public.profiles (id, user_id, email, name, username)
  values (new.id, new.id, new.email, v_name, v_username)
  on conflict (id) do update
    set user_id = excluded.user_id,
        email   = excluded.email,
        name    = case when profiles.name = '' or profiles.name is null
                       then excluded.name else profiles.name end;

  return new;
exception when others then
  insert into public.trigger_errors (source, context, sqlstate, message)
  values ('handle_new_user', jsonb_build_object('user_id', new.id), sqlstate, sqlerrm);
  return new;
end;
$$;
