-- ============================================================================
-- PANEL VERİ DOĞRULUĞU
-- ============================================================================
--
-- 1) Sayaç hizalaması: personas.view_count ile profiles.card_views aynı şeyi
--    söylesin. Personalar hep ANA profil kartıydı; persona sisteminden önceki
--    görüntülenmelerin tamamı ana karta aitti. Panel 1, profil listesi 188
--    gösteriyordu.
update public.personas x
   set view_count = coalesce(p.card_views, 0)
  from public.profiles p
 where p.id = x.profile_id and x.is_primary
   and coalesce(x.view_count, 0) < coalesce(p.card_views, 0);

-- ---------------------------------------------------------------------------
-- 2) my_card_analytics — kişinin kendi analitiği SUNUCUDA toplanır.
--
--    Panel olay satırlarını tarayıcıya çekip sayıyordu. PostgREST varsayılan
--    olarak 1000 satır döndürdüğü için 1000 olaydan sonra BÜTÜN kutular
--    sessizce eksik gösterecekti — kimse fark etmeden. Tarih filtresi de hiç
--    uygulanmıyordu: "bu ay" seçmek sayıları değiştirmiyordu.
--
--    "Doğrudan giriş" yalnızca ÖLÇÜLMÜŞ doğrudan girişi sayar. Kaynağı hiç
--    işaretlenmemiş eski kayıtlar ayrı bir alanda ('kaynaksiz') döner; onları
--    doğrudan saymak, bilmediğimiz şeyi biliyormuş gibi göstermek olurdu.
-- ---------------------------------------------------------------------------
create or replace function public.my_card_analytics(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_prof uuid := public.my_profile_id(); v_bas timestamptz; v_bit timestamptz; v_sonuc jsonb;
begin
  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  -- Gün sınırları: p_to = now() geldiğinde BUGÜN dışarıda kalmasın.
  v_bas := case when p_from is null then null else date_trunc('day', p_from) end;
  v_bit := case when p_to is null then null else date_trunc('day', p_to) + interval '1 day' end;

  select jsonb_build_object(
    'ok', true,
    'toplam_goruntulenme', count(*) filter (where event_type in ('profile_view','qr_scan','nfc_tap')),
    'qr',       count(*) filter (where source = 'qr'  or event_type = 'qr_scan'),
    'nfc',      count(*) filter (where source = 'nfc' or event_type = 'nfc_tap'),
    'baglanti', count(*) filter (where event_type = 'profile_view' and source = 'link'),
    'dogrudan', count(*) filter (where event_type = 'profile_view' and source = 'direct'),
    'rehbere_kaydetme', count(*) filter (where event_type = 'vcard_download'),
    'baglanti_tiklama', count(*) filter (where event_type = 'link_click'),
    'paylasim', count(*) filter (where event_type = 'share'),
    -- Kaynağı işaretlenmemiş eski kayıtlar: arayüz "ölçüm yok" diyebilsin.
    'kaynaksiz', count(*) filter (where event_type = 'profile_view' and source is null)
  ) into v_sonuc
  from public.analytics_events
  where profile_id = v_prof
    and (v_bas is null or created_at >= v_bas)
    and (v_bit is null or created_at <  v_bit);

  -- Ömür boyu sayaç olay kaydından ÖNCE başladı; panel ile profil listesinin
  -- aynı sayıyı söyleyebilmesi için ayrıca döner.
  return v_sonuc || jsonb_build_object(
    'omur_boyu_goruntulenme', (select coalesce(card_views, 0) from public.profiles where id = v_prof));
end;
$function$;

revoke all on function public.my_card_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.my_card_analytics(timestamptz, timestamptz) to authenticated;

comment on function public.my_card_analytics(timestamptz, timestamptz) is
  'Kart sahibinin kendi analitiği; sunucuda toplanır (istemci sayımı 1000 satırda sessizce kesiliyordu).';

-- ---------------------------------------------------------------------------
-- 3) organizational_commissions: aynı dönemin iki kez hesaplanmasını önleyen
--    tekillik yoktu; hesaplama fonksiyonundaki ON CONFLICT dayanacak kısıt
--    bulamıyor, her çalıştırma dönemi kopyalıyordu.
-- ---------------------------------------------------------------------------
create unique index if not exists organizational_commissions_donem_key
  on public.organizational_commissions (organization_id, period_year, period_month);
