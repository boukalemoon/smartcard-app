-- ============================================================================
-- DEPOLAMA KOVASI SINIRLARI VE ANONİM OLAY GÖVDESİ TAVANI
-- ============================================================================
--
-- Denetim bulguları O-10 ve D-14 (08.10.2026).
--
-- O-10 — YÜKLEME DENETİMİ YALNIZCA İSTEMCİDEYDİ
--   ImageUpload.jsx dosya türünü ve boyutunu tarayıcıda kontrol ediyor; bu
--   kontrolü atlayan biri herkese açık kovalara (avatars, backgrounds, logos)
--   istediği dosyayı yükleyebiliyordu: SVG/HTML (kova alan adında betik),
--   çalıştırılabilir dosya, sınırsız boyut. Kural kovanın kendisine konuyor.
--   SVG BİLEREK dışarıda: içinde betik taşıyabilir.
--   Boyut: arayüzdeki en büyük sınır (arka plan 5 MB) ile aynı.
--
-- D-14 — ANONİM OLAY GÖVDESİ SINIRSIZDI
--   track_card_event anonime açık ve p_meta'yı (yalnızca ip/email/phone
--   anahtarlarını silerek) olduğu gibi analytics_events.metadata'ya yazıyor.
--   Hız sınırı var ama gövde boyutu yok: her çağrıda megabaytlarca JSON
--   yazılabiliyordu. Fonksiyonun gövdesine dokunmadan (birden çok sürümü
--   var) tabloya bir tavan konuyor: 2 KB'ı aşan metadata boşaltılır, olay
--   yine sayılır.

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
       file_size_limit    = 5 * 1024 * 1024
 where id in ('avatars', 'backgrounds', 'logos');

create or replace function public.analytics_events_metadata_tavan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.metadata is not null and octet_length(new.metadata::text) > 2048 then
    new.metadata := jsonb_build_object('kirpildi', true);
  end if;
  return new;
end;
$$;

revoke all on function public.analytics_events_metadata_tavan() from public, anon, authenticated;

do $mig$
begin
  if to_regclass('public.analytics_events') is not null then
    execute 'drop trigger if exists analytics_events_metadata_tavan_trg on public.analytics_events';
    execute 'create trigger analytics_events_metadata_tavan_trg before insert or update of metadata '
            'on public.analytics_events for each row execute function public.analytics_events_metadata_tavan()';
  end if;
end
$mig$;
