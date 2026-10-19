-- ============================================================================
-- persona_update: social_layout yazılabilsin
-- ============================================================================
--
-- HATA (Burak bildirdi, 19.10.2026): Bloklar → Sosyal'de görünüm seçeneğine
-- basınca "İşlem tamamlanamadı" çıkıyordu; seçim kaydedilmediği için ne
-- önizlemede ne kartta görünüyordu.
--
-- SEBEP: 20261019150000 personas.social_layout kolonunu ve arayüzü ekledi ama
-- persona_update'in YAZMA BEYAZ LİSTESİNE eklemeyi atladım. Fonksiyon
-- izinsiz alan görünce 'izinsiz_alan' döndürüyordu.
--
-- Beyaz liste doğru tasarım ve bu yüzden daha kötüsü olmadı: istemci
-- personas'a rastgele kolon yazamıyor. Eksik olan tek şey yeni alanın
-- listeye ve UPDATE'e girmesiydi.
--
-- Gövde canlıdaki sürümün aynısı; yalnız üç yer değişti:
--   1) v_izin dizisine 'social_layout'
--   2) değer denetimi (kutu | genis | ikon, boş = varsayılan)
--   3) UPDATE'e social_layout satırı

create or replace function public.persona_update(p_persona_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_x public.personas; v_ad text;
  v_izin constant text[] := array['name','display_name','avatar_url','status',
                                  'show_organizations','show_payment','theme_color','sort_order','kind',
                                  'social_layout'];
  k text;
begin
  v_x := public.persona_owned(p_persona_id);
  if v_x.id is null then
    return jsonb_build_object('ok', false, 'hata', 'persona_bulunamadi');
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_veri');
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any (v_izin)) then
      return jsonb_build_object('ok', false, 'hata', 'izinsiz_alan', 'alan', k);
    end if;
  end loop;

  if p_patch ? 'name' then
    v_ad := nullif(btrim(p_patch->>'name'), '');
    if v_ad is null or length(v_ad) > 40 then
      return jsonb_build_object('ok', false, 'hata', 'gecersiz_ad');
    end if;
    if exists (select 1 from public.personas where profile_id = v_x.profile_id
                  and id <> v_x.id and lower(btrim(name)) = lower(v_ad)) then
      return jsonb_build_object('ok', false, 'hata', 'ayni_ad_var');
    end if;
  end if;

  if p_patch ? 'status' and p_patch->>'status' not in ('active','paused') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_durum');
  end if;
  if p_patch->>'status' = 'paused' and v_x.is_primary then
    return jsonb_build_object('ok', false, 'hata', 'ana_persona_duraklatilamaz');
  end if;
  if p_patch ? 'kind' and not exists (select 1 from public.persona_kinds where key = p_patch->>'kind' and is_active) then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_tur');
  end if;
  if p_patch ? 'avatar_url' and coalesce(p_patch->>'avatar_url', '') <> ''
     and (p_patch->>'avatar_url') !~* '^https://' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_fotograf_adresi');
  end if;
  if p_patch ? 'display_name' and length(coalesce(p_patch->>'display_name', '')) > 80 then
    return jsonb_build_object('ok', false, 'hata', 'gorunen_ad_cok_uzun');
  end if;

  -- YENİ: sosyal bağlantı görünümü. Boş gelirse null yazılır = varsayılan
  -- ('kutu'). Kolondaki kısıt da aynı üçlüyü kabul ediyor; burada denetlemek
  -- kullanıcıya anlaşılır hata döndürmek için.
  if p_patch ? 'social_layout'
     and coalesce(p_patch->>'social_layout', '') <> ''
     and (p_patch->>'social_layout') not in ('kutu','genis','ikon') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_sosyal_gorunum');
  end if;

  update public.personas set
    name               = coalesce(v_ad, name),
    display_name       = case when p_patch ? 'display_name' then nullif(btrim(p_patch->>'display_name'), '') else display_name end,
    avatar_url         = case when p_patch ? 'avatar_url'   then nullif(btrim(p_patch->>'avatar_url'), '')   else avatar_url end,
    status             = coalesce(p_patch->>'status', status),
    show_organizations = coalesce((p_patch->>'show_organizations')::boolean, show_organizations),
    show_payment       = coalesce((p_patch->>'show_payment')::boolean, show_payment),
    theme_color        = case when p_patch ? 'theme_color' then nullif(p_patch->>'theme_color', '') else theme_color end,
    sort_order         = coalesce((p_patch->>'sort_order')::int, sort_order),
    kind               = coalesce(p_patch->>'kind', kind),
    social_layout      = case when p_patch ? 'social_layout' then nullif(p_patch->>'social_layout', '') else social_layout end,
    updated_at         = now()
  where id = v_x.id;

  perform public.log_event('persona.updated', auth.uid(), 'qrtim', 'persona', v_x.id::text,
                           'success', 'info', 'user',
                           jsonb_build_object('alanlar', (select jsonb_agg(k2) from jsonb_object_keys(p_patch) k2)));

  return jsonb_build_object('ok', true);
end;
$function$;

comment on function public.persona_update(uuid, jsonb) is
  'Persona alanlarini beyaz listeyle guncellemek. social_layout 19.10.2026 da eklendi (kolon eklenirken atlanmisti).';
