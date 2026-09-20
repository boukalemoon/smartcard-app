-- ============================================================================
-- BAĞLANTI YÖNETİCİSİ (Linktree karşılaştırmasından alınanlar)
-- ============================================================================
--
-- Bağlantılarımız yalnızca "platform + adres"ti: başlık yok, yayın durumu yok,
-- tarih yok, sıralama dışında öne çıkarma yok. Esnafın "bu kampanya bir hafta
-- açık kalsın" ya da "önce şuna baksınlar" demesi mümkün değildi.
--
-- FİLTRE SUNUCUDA: gizli ya da süresi geçmiş bağlantıyı istemciye gönderip
-- orada saklamak, saklamak değil göndermektir.

alter table public.social_links
  add column if not exists etiket           text,
  add column if not exists aktif            boolean not null default true,
  add column if not exists one_cikan        boolean not null default false,
  add column if not exists yayin_baslangic  timestamptz,
  add column if not exists yayin_bitis      timestamptz;

alter table public.social_links drop constraint if exists social_links_etiket_chk;
alter table public.social_links add constraint social_links_etiket_chk
  check (etiket is null or char_length(btrim(etiket)) between 1 and 60);

alter table public.social_links drop constraint if exists social_links_yayin_chk;
alter table public.social_links add constraint social_links_yayin_chk
  check (yayin_baslangic is null or yayin_bitis is null or yayin_bitis > yayin_baslangic);

comment on column public.social_links.etiket is
  'Kartta gorunen baslik. Bos ise platform adi kullanilir.';
comment on column public.social_links.aktif is
  'Kapali baglanti kartta hic gorunmez; silmeden gizlemek icin.';
comment on column public.social_links.yayin_bitis is
  'Suresi dolan baglanti kartta gorunmez. Filtre SUNUCUDA uygulanir.';

-- build_public_card'ın bağlantı sorgusu (tam gövde 20260921140000'de):
--   ... where l.persona_id = v_x.id
--         and s.url ~* '^https?://'
--         and s.aktif
--         and (s.yayin_baslangic is null or s.yayin_baslangic <= now())
--         and (s.yayin_bitis is null or s.yayin_bitis > now())
--   order by s.one_cikan desc, s.display_order
-- ve dönen nesneye 'etiket' ile 'one_cikan' eklendi.

-- ---------------------------------------------------------------------------
-- Hangi bağlantı çalışıyor?
-- ---------------------------------------------------------------------------
-- Tıklama olayları başından beri hangi bağlantıya ait olduğu bilgisiyle
-- kaydediliyordu (metadata.label / metadata.platform), panel ise yalnızca
-- TOPLAMI gösteriyordu: "14 tıklama" — hangisine, belli değil.
--
-- ÜSTÜNLÜĞÜMÜZ: tıklamayı KAYNAĞIYLA veriyoruz. "Bu bağlantıya çoğunlukla QR
-- okutanlar tıklıyor" cümlesini bağlantı listesi ürünleri kuramaz; onlarda
-- basılı kart ile bağlantı aynı ölçüm hattında değil.
--
-- NOT: kolon adı 'metadata'; ilk yazımda 'meta' demiştim (log_event'in
-- parametre adıyla karıştı) ve test ilk çağrıda yakaladı.
create or replace function public.my_link_performance(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare v_prof uuid := public.my_profile_id(); v_bas timestamptz; v_bit timestamptz; v_sonuc jsonb;
begin
  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  v_bas := case when p_from is null then null else date_trunc('day', p_from) end;
  v_bit := case when p_to is null then null else date_trunc('day', p_to) + interval '1 day' end;

  with tiklamalar as (
    select case when e.metadata->>'link_id' ~ '^[0-9a-f-]{36}$'
                then (e.metadata->>'link_id')::uuid end as link_id,
           nullif(e.metadata->>'label', '')    as etiket,
           nullif(e.metadata->>'platform', '') as platform,
           e.source
      from public.analytics_events e
     where e.profile_id = v_prof
       and e.event_type = 'link_click'
       and (v_bas is null or e.created_at >= v_bas)
       and (v_bit is null or e.created_at <  v_bit)
  ),
  -- Eski olaylarda link_id yok; onlar etiket/platform ile eşleşir.
  gruplu as (
    select coalesce(t.link_id::text, lower(coalesce(t.platform, t.etiket, 'bilinmeyen'))) as anahtar,
           max(coalesce(t.etiket, t.platform)) as ad,
           count(*) as toplam,
           count(*) filter (where t.source = 'qr')  as qr,
           count(*) filter (where t.source = 'nfc') as nfc,
           count(*) filter (where t.source is null) as kaynaksiz
      from tiklamalar t
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ad', coalesce(s.etiket, g.ad, s.platform),
           'platform', s.platform,
           'url', s.url,
           -- Silinmiş bağlantının tıklamaları da görünür; yoksa geçmiş toplam
           -- ile kalemlerin toplamı tutmazdı.
           'hala_var', s.id is not null,
           'toplam', g.toplam, 'qr', g.qr, 'nfc', g.nfc, 'kaynaksiz', g.kaynaksiz)
           order by g.toplam desc), '[]'::jsonb)
    into v_sonuc
    from gruplu g
    left join public.social_links s
           on s.profile_id = v_prof
          and (s.id::text = g.anahtar or lower(s.platform) = g.anahtar);

  return jsonb_build_object('ok', true, 'baglantilar', v_sonuc);
end;
$fn$;

revoke all on function public.my_link_performance(timestamptz, timestamptz) from public, anon;
grant execute on function public.my_link_performance(timestamptz, timestamptz) to authenticated;

comment on function public.my_link_performance(timestamptz, timestamptz) is
  'Baglanti bazli tiklama raporu, kaynak (QR/NFC) kirilimiyla. Silinmis baglantinin tiklamalari da gorunur (hala_var=false).';
