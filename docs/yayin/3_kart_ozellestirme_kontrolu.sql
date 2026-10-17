-- Kart özelleştirme alanları: arayüz yazıyor da sunucu döndürüyor mu?
--
-- NEDEN: Yeni panel kapak görselini (background_image_url) ve tema rengini
-- (theme_color) yazıyor, herkese açık kart da bunları OKUYOR
-- (src/site/kart/Baslik.jsx). Arada build_public_card var: alanı döndürmüyorsa
-- kullanıcı kapak yükler, panelde önizlemede görür, KAYIT DA BAŞARILI OLUR
-- ama herkese açık kartta hiç çıkmaz. Sessiz kayıp; arayüzden fark edilmez.
--
-- SQL Editor'de çalıştırın. Her satırda "durum" sütununa bakın.

-- 1) Alanlar build_public_card'ın döndürdüğü gövdede geçiyor mu?
with govde as (
  select pg_get_functiondef(p.oid) as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'build_public_card'
)
select 'build_public_card' as yer, x as alan,
       case when (select src from govde) like '%' || x || '%'
            then 'TAMAM' else 'EKSIK -> herkese acik kartta gorunmez' end as durum
from unnest(array['background_image_url','theme_color','avatar_3d_url','avatar_url']) x

union all

-- 2) Kolonlar duruyor mu?
select 'profiles kolonu', x,
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'profiles'
                           and column_name = x)
            then 'TAMAM' else 'KOLON YOK' end
from unnest(array['background_image_url','theme_color','theme_style','avatar_3d_url']) x

order by 1, 2;

-- 3) Veride ne var? (arayüzü silinen alanlarda kayıtlı veri kalmış mı)
select
  count(*)                                                                  as toplam_profil,
  count(*) filter (where coalesce(background_image_url, '') <> '')           as kapak_gorseli_olan,
  count(*) filter (where coalesce(theme_color, '') <> '')                    as tema_rengi_olan,
  -- theme_style arayüzde HİÇ kullanılmıyordu (eski sürümde de); doluysa nereden geldiği araştırılmalı.
  count(*) filter (where coalesce(theme_style, '') <> '')                    as tema_stili_olan,
  -- avatar_3d_url'i yazan arayüz (ReadyPlayerMeAvatar) silindi ama kart hâlâ okuyor:
  -- buradaki sayı > 0 ise o kişiler 3B avatarını artık değiştiremez/kaldıramaz.
  count(*) filter (where coalesce(avatar_3d_url, '') <> '')                  as uc_boyutlu_avatari_olan
from public.profiles;
