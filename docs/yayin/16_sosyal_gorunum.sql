-- ============================================================================
-- Sosyal bağlantı görünümü — profil (persona) başına seçilebilir
-- ============================================================================
--
-- İSTEK (Burak, 19.10.2026): "bir kullanıcı bireysel paylaşımlarında büyük
-- buton kullanmak isteyebilir, kurumsal profilinde küçük buton kullanmak
-- isteyebilir" — yani ayar PROFİL BAŞINA.
--
-- Yer personas tablosu: orada zaten profil başına görünüm bayrakları var
-- (theme_color, show_organizations, show_payment). Ayrı tablo açmaya gerek yok.
--
-- Değerler:
--   'kutu'  — iki kolon, ikon + etiket. BUGÜNKÜ DAVRANIŞ, varsayılan.
--   'genis' — tam genişlik buton, ikon + etiket + dış bağlantı oku.
--   'ikon'  — yalnız ikonlar, tek sıra (etiket yok).
-- Varsayılan 'kutu': mevcut kartların hiçbiri değişmiyor.
--
-- ---------------------------------------------------------------------------
-- build_public_card GÖVDESİNE DOKUNULMUYOR — bilinçli
-- ---------------------------------------------------------------------------
-- O fonksiyon 4,3 KB ve uygulamanın en kritik parçası: herkese açık kartın
-- tamamını o üretiyor. Tek satır eklemek için 4,3 KB'ı yeniden yazmak, tek
-- karakterlik sessiz bir hata riskini göze almak demekti.
--
-- Bunun yerine: mevcut fonksiyon ADI DEĞİŞTİRİLİYOR (gövde aynen kalıyor) ve
-- üstüne eski adı taşıyan küçük bir sarmalayıcı konuyor. Üç çağıran
-- (get_public_card, get_public_card_by_code, resolve_custom_domain) hiç
-- değişmiyor; isimle çağırdıkları için yeni sarmalayıcıya düşüyorlar.

-- ---------------------------------------------------------------------------
-- 1) Kolon
-- ---------------------------------------------------------------------------
alter table public.personas
  add column if not exists social_layout text;

alter table public.personas
  drop constraint if exists personas_social_layout_chk;
alter table public.personas
  add constraint personas_social_layout_chk
  check (social_layout is null or social_layout in ('kutu', 'genis', 'ikon'));

comment on column public.personas.social_layout is
  'Sosyal baglanti gorunumu: kutu (iki kolon, varsayilan) | genis (tam genislik) | ikon (yalniz ikon). null = kutu.';

-- ---------------------------------------------------------------------------
-- 2) Mevcut fonksiyonu yeniden adlandır (gövde değişmiyor)
-- ---------------------------------------------------------------------------
-- Yalnızca ilk çalıştırmada: ikinci kez uygulanırsa temel zaten var.
do $tasi$
begin
  if to_regprocedure('public.build_public_card_temel(uuid,uuid)') is null then
    alter function public.build_public_card(uuid, uuid) rename to build_public_card_temel;
  end if;
end $tasi$;

comment on function public.build_public_card_temel(uuid, uuid) is
  'Herkese acik kart govdesi. DOGRUDAN CAGRILMAZ: build_public_card sarmalayicisi uzerinden kullanilir.';

-- ---------------------------------------------------------------------------
-- 3) Eski adı taşıyan sarmalayıcı
-- ---------------------------------------------------------------------------
-- Özellikler temelle aynı tutuldu: stable, security definer, search_path=''.
create or replace function public.build_public_card(p_profile_id uuid, p_persona_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_kart jsonb; v_gorunum text;
begin
  v_kart := public.build_public_card_temel(p_profile_id, p_persona_id);
  -- Temel null döndürdüyse (kart yok/durdurulmuş) öyle kalsın: jsonb birleştirme
  -- null ile null verir ama niyeti açıkça yazıyoruz.
  if v_kart is null then
    return null;
  end if;

  select pe.social_layout into v_gorunum
    from public.personas pe where pe.id = p_persona_id;

  return v_kart || jsonb_build_object('social_layout', coalesce(v_gorunum, 'kutu'));
end;
$$;

-- Yetkiler temeldekiyle aynı: istemci bu fonksiyonu doğrudan çağırmıyor,
-- get_public_card üzerinden geliyor.
revoke all on function public.build_public_card(uuid, uuid) from public, anon, authenticated;
grant execute on function public.build_public_card(uuid, uuid) to service_role;

revoke all on function public.build_public_card_temel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.build_public_card_temel(uuid, uuid) to service_role;

comment on function public.build_public_card(uuid, uuid) is
  'Herkese acik kart + persona bazli sosyal gorunum. Govde build_public_card_temel de; buraya yalnizca social_layout ekleniyor.';
