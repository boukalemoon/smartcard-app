-- ============================================================================
-- PERSONA FONKSİYONLARI — yönetim ve herkese açık kart
-- ============================================================================
--
-- Tüm yazma işlemleri bu fonksiyonlardan geçer: sahiplik, değer türü ve plan
-- sınırı doğrulanır, her değişiklik denetim kaydına düşer.

-- ===========================================================================
-- Yardımcı: persona gerçekten çağıranın mı
-- ===========================================================================

create or replace function public.persona_owned(p_persona_id uuid)
returns public.personas
language sql
stable
security definer
set search_path = ''
as $fn$
  select x.* from public.personas x
   where x.id = p_persona_id and x.profile_id = public.my_profile_id();
$fn$;

revoke all on function public.persona_owned(uuid) from public, anon, authenticated;

-- ===========================================================================
-- Liste
-- ===========================================================================

create or replace function public.persona_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'kind', x.kind, 'kind_label', k.label,
           'name', x.name, 'display_name', x.display_name,
           'is_primary', x.is_primary, 'status', x.status,
           'share_code', x.share_code,
           'show_organizations', x.show_organizations, 'show_payment', x.show_payment,
           'view_count', x.view_count, 'last_viewed_at', x.last_viewed_at,
           'visible_fields', (select count(*) from public.profile_fields f
                               where f.persona_id = x.id and f.visibility = 'public'),
           'visible_links',  (select count(*) from public.persona_social_links l
                               where l.persona_id = x.id),
           'created_at', x.created_at
         ) order by x.is_primary desc, x.sort_order, x.created_at), '[]'::jsonb)
    from public.personas x
    join public.persona_kinds k on k.key = x.kind
   where x.profile_id = public.my_profile_id();
$fn$;

-- ===========================================================================
-- Düzenleyici için tek persona'nın tüm verisi
-- ===========================================================================

create or replace function public.persona_editor(p_persona_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_x   public.personas;
  v_row jsonb;
begin
  v_x := public.persona_owned(p_persona_id);
  if v_x.id is null then
    return jsonb_build_object('ok', false, 'hata', 'persona_bulunamadi');
  end if;

  select to_jsonb(p) into v_row from public.profiles p where p.id = v_x.profile_id;

  return jsonb_build_object(
    'ok', true,
    'persona', to_jsonb(v_x) - 'profile_id',
    'profile_name', v_row->>'name',
    'profile_avatar_url', v_row->>'avatar_url',
    'fields', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'key', c.key, 'category', c.category, 'label', c.label,
               'value_type', c.value_type, 'sensitive', c.sensitive,
               'visibility', coalesce(f.visibility, 'private'),
               'override_value', f.field_value,
               'base_value', case when c.base_column is not null then v_row -> c.base_column end,
               'has_base', c.base_column is not null,
               'verified', f.verified_at is not null
             ) order by c.sort_order), '[]'::jsonb)
        from public.profile_field_catalog c
        left join public.profile_fields f on f.persona_id = v_x.id and f.field_key = c.key
       where c.is_active),
    'social_links', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'platform', s.platform, 'url', s.url,
               'visible', exists (select 1 from public.persona_social_links l
                                   where l.persona_id = v_x.id and l.social_link_id = s.id)
             ) order by s.display_order), '[]'::jsonb)
        from public.social_links s where s.profile_id = v_x.profile_id)
  );
end;
$fn$;

-- ===========================================================================
-- Oluştur
-- ===========================================================================

create or replace function public.persona_create(
  p_kind      text,
  p_name      text default null,
  p_copy_from uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_prof   uuid := public.my_profile_id();
  v_tur    public.persona_kinds;
  v_kaynak public.personas;
  v_limit  int;
  v_sayi   int;
  v_ad     text;
  v_yeni   public.personas;
begin
  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  select * into v_tur from public.persona_kinds where key = p_kind and is_active;
  if v_tur.key is null then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_tur');
  end if;

  if p_copy_from is not null then
    v_kaynak := public.persona_owned(p_copy_from);
    if v_kaynak.id is null then
      return jsonb_build_object('ok', false, 'hata', 'kaynak_persona_bulunamadi');
    end if;
  end if;

  select coalesce(pf.persona_limit, 2) into v_limit
    from public.subscriptions s
    left join public.plan_features pf on pf.plan = coalesce(s.plan, 'free')
   where s.profile_id = v_prof;
  v_limit := coalesce(v_limit, 2);

  select count(*) into v_sayi from public.personas where profile_id = v_prof;
  if v_sayi >= v_limit then
    return jsonb_build_object('ok', false, 'hata', 'limit_asildi', 'limit', v_limit);
  end if;

  v_ad := nullif(btrim(coalesce(p_name, '')), '');
  if v_ad is null then v_ad := v_tur.label; end if;
  if length(v_ad) > 40 then
    return jsonb_build_object('ok', false, 'hata', 'ad_cok_uzun');
  end if;
  if exists (select 1 from public.personas where profile_id = v_prof and lower(btrim(name)) = lower(v_ad)) then
    return jsonb_build_object('ok', false, 'hata', 'ayni_ad_var');
  end if;

  insert into public.personas (profile_id, kind, name, is_primary,
                               show_organizations, show_payment, display_name, avatar_url, sort_order)
  values (v_prof, v_tur.key, v_ad, false,
          coalesce(v_kaynak.show_organizations, v_tur.key in ('is','akademik','etkinlik')),
          false,   -- ödeme bilgisi hiçbir zaman kendiliğinden açılmaz
          v_kaynak.display_name, v_kaynak.avatar_url, v_sayi)
  returning * into v_yeni;

  if v_kaynak.id is not null then
    -- Kopyala: görünürlük ve kişiye özel değerler aynen
    insert into public.profile_fields (profile_id, persona_id, field_key, visibility, field_value, display_order)
    select v_prof, v_yeni.id, f.field_key, f.visibility, f.field_value, f.display_order
      from public.profile_fields f where f.persona_id = v_kaynak.id;

    insert into public.persona_social_links (persona_id, profile_id, social_link_id)
    select v_yeni.id, v_prof, l.social_link_id
      from public.persona_social_links l where l.persona_id = v_kaynak.id;
  else
    -- Şablon: türün önerdiği alanlar açık, HASSAS alanlar her zaman kapalı
    insert into public.profile_fields (profile_id, persona_id, field_key, visibility, display_order)
    select v_prof, v_yeni.id, c.key,
           case when c.key = any (v_tur.default_fields) and not c.sensitive then 'public' else 'private' end,
           c.sort_order
      from public.profile_field_catalog c where c.is_active;
  end if;

  perform public.log_event('persona.created', auth.uid(), 'qrtim', 'persona', v_yeni.id::text,
                           'success', 'notice', 'user',
                           jsonb_build_object('tur', v_tur.key, 'ad', v_ad,
                                              'kopya', p_copy_from is not null));

  return jsonb_build_object('ok', true, 'id', v_yeni.id, 'share_code', v_yeni.share_code);
end;
$fn$;

-- ===========================================================================
-- Güncelle (ad, görünen ad, fotoğraf, durum, bölüm anahtarları)
-- ===========================================================================

create or replace function public.persona_update(p_persona_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_x   public.personas;
  v_ad  text;
  v_izin constant text[] := array['name','display_name','avatar_url','status',
                                  'show_organizations','show_payment','theme_color','sort_order','kind'];
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
    -- Ana persona basılı kartların gösterdiği profildir; duraklatılamaz.
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
    updated_at         = now()
  where id = v_x.id;

  perform public.log_event('persona.updated', auth.uid(), 'qrtim', 'persona', v_x.id::text,
                           'success', 'info', 'user',
                           jsonb_build_object('alanlar', (select jsonb_agg(k2) from jsonb_object_keys(p_patch) k2)));

  return jsonb_build_object('ok', true);
end;
$fn$;

-- ===========================================================================
-- Ana persona yap
-- ===========================================================================

create or replace function public.persona_set_primary(p_persona_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_x public.personas; v_eski uuid;
begin
  v_x := public.persona_owned(p_persona_id);
  if v_x.id is null then
    return jsonb_build_object('ok', false, 'hata', 'persona_bulunamadi');
  end if;
  if v_x.is_primary then
    return jsonb_build_object('ok', true, 'degisiklik_yok', true);
  end if;

  select id into v_eski from public.personas where profile_id = v_x.profile_id and is_primary;

  -- ÖNCE bayrak: persona metnini profile_fields_resolve_persona tetikleyicisi
  -- is_primary'ye bakarak hesaplar. Bayrak çevrilmeden metin değiştirilirse
  -- tetikleyici onu geri 'default' yapar ve tekillik kısıtı çakışır.
  update public.personas set is_primary = false, updated_at = now()
   where profile_id = v_x.profile_id and is_primary;
  update public.personas set is_primary = true, status = 'active', updated_at = now()
   where id = v_x.id;
  -- Eski FieldVisibilityManager uyumu: 'default' metni ana persona'yı izler.
  -- İki ayrı ifade: önce eski ana 'default'ı bırakır, sonra yeni ana alır.
  update public.profile_fields set persona = persona where persona_id = v_eski;
  update public.profile_fields set persona = persona where persona_id = v_x.id;

  perform public.log_event('persona.primary_changed', auth.uid(), 'qrtim', 'persona', v_x.id::text,
                           'success', 'warning', 'user',
                           jsonb_build_object('onceki_ana', v_eski, 'yeni_ana', v_x.id,
                                              'not', 'Basili NFC/QR kartlar artik bu profili gosterir'));

  return jsonb_build_object('ok', true);
end;
$fn$;

-- ===========================================================================
-- Sil
-- ===========================================================================

create or replace function public.persona_delete(p_persona_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_x public.personas;
begin
  v_x := public.persona_owned(p_persona_id);
  if v_x.id is null then
    return jsonb_build_object('ok', false, 'hata', 'persona_bulunamadi');
  end if;
  if v_x.is_primary then
    return jsonb_build_object('ok', false, 'hata', 'ana_persona_silinemez');
  end if;

  delete from public.personas where id = v_x.id;

  perform public.log_event('persona.deleted', auth.uid(), 'qrtim', 'persona', v_x.id::text,
                           'success', 'warning', 'user',
                           jsonb_build_object('ad', v_x.name, 'tur', v_x.kind,
                                              'goruntulenme', v_x.view_count));
  return jsonb_build_object('ok', true);
end;
$fn$;

-- ===========================================================================
-- Paylaşım kodunu yenile — eski bağlantı ve QR anında geçersiz
-- ===========================================================================

create or replace function public.persona_rotate_code(p_persona_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_x public.personas; v_kod text;
begin
  v_x := public.persona_owned(p_persona_id);
  if v_x.id is null then
    return jsonb_build_object('ok', false, 'hata', 'persona_bulunamadi');
  end if;

  update public.personas
     set share_code = public.new_share_code(), code_rotated_at = now(), updated_at = now()
   where id = v_x.id
  returning share_code into v_kod;

  perform public.log_event('persona.code_rotated', auth.uid(), 'qrtim', 'persona', v_x.id::text,
                           'success', 'warning', 'user',
                           jsonb_build_object('not', 'Onceki baglanti ve QR gecersiz oldu'));

  return jsonb_build_object('ok', true, 'share_code', v_kod);
end;
$fn$;

-- ===========================================================================
-- Alan: görünürlük ve persona'ya özel değer
-- ===========================================================================

create or replace function public.persona_set_field(
  p_persona_id     uuid,
  p_field_key      text,
  p_visibility     text    default null,
  p_value          jsonb   default null,
  p_clear_override boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_x   public.personas;
  v_c   public.profile_field_catalog;
  v_txt text;
begin
  v_x := public.persona_owned(p_persona_id);
  if v_x.id is null then
    return jsonb_build_object('ok', false, 'hata', 'persona_bulunamadi');
  end if;

  select * into v_c from public.profile_field_catalog where key = p_field_key and is_active;
  if v_c.key is null then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_alan');
  end if;

  if p_visibility is not null and p_visibility not in ('public', 'private') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_gorunurluk');
  end if;

  -- Değer doğrulama (kart herkese açık: çöp veri yayımlanmasın)
  if p_value is not null and jsonb_typeof(p_value) <> 'null' then
    if v_c.value_type = 'list' then
      if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 50
         or pg_column_size(p_value) > 20000 then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz_liste');
      end if;
    else
      if jsonb_typeof(p_value) <> 'string' then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz_deger');
      end if;
      v_txt := btrim(p_value #>> '{}');
      if (v_c.value_type = 'email'    and (v_txt !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_txt) > 254))
      or (v_c.value_type = 'phone'    and v_txt !~ '^\+?[0-9 ()-]{6,25}$')
      or (v_c.value_type = 'url'      and (v_txt !~* '^https?://[^\s]+$' or length(v_txt) > 500))
      or (v_c.value_type = 'text'     and length(v_txt) > 120)
      or (v_c.value_type = 'longtext' and length(v_txt) > 2000) then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz_deger', 'tur', v_c.value_type);
      end if;
      p_value := to_jsonb(v_txt);
    end if;
  end if;

  insert into public.profile_fields as f (profile_id, persona_id, field_key, visibility, field_value, display_order)
  values (v_x.profile_id, v_x.id, v_c.key, coalesce(p_visibility, 'private'),
          case when p_clear_override then null else p_value end, v_c.sort_order)
  on conflict (persona_id, field_key) do update
    set visibility  = coalesce(p_visibility, f.visibility),
        field_value = case when p_clear_override then null
                           when p_value is not null then p_value
                           else f.field_value end,
        -- Değer değişirse eski doğrulama geçerli değildir.
        verified_at = case when p_value is not null or p_clear_override then null else f.verified_at end;

  perform public.log_event('persona.field_changed', auth.uid(), 'qrtim', 'persona', v_x.id::text,
                           'success', 'info', 'user',
                           jsonb_strip_nulls(jsonb_build_object(
                             'alan', v_c.key, 'gorunurluk', p_visibility,
                             'deger_degisti', (p_value is not null or p_clear_override))));

  return jsonb_build_object('ok', true);
end;
$fn$;

-- ===========================================================================
-- Sosyal bağlantı: bu persona'da görünsün mü
-- ===========================================================================

create or replace function public.persona_set_social_link(
  p_persona_id uuid, p_social_link_id uuid, p_visible boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_x public.personas;
begin
  v_x := public.persona_owned(p_persona_id);
  if v_x.id is null then
    return jsonb_build_object('ok', false, 'hata', 'persona_bulunamadi');
  end if;
  if not exists (select 1 from public.social_links where id = p_social_link_id and profile_id = v_x.profile_id) then
    return jsonb_build_object('ok', false, 'hata', 'baglanti_bulunamadi');
  end if;

  if p_visible then
    insert into public.persona_social_links (persona_id, profile_id, social_link_id)
    values (v_x.id, v_x.profile_id, p_social_link_id) on conflict do nothing;
  else
    delete from public.persona_social_links where persona_id = v_x.id and social_link_id = p_social_link_id;
  end if;

  perform public.log_event('persona.link_changed', auth.uid(), 'qrtim', 'persona', v_x.id::text,
                           'success', 'info', 'user',
                           jsonb_build_object('baglanti', p_social_link_id, 'gorunur', p_visible));
  return jsonb_build_object('ok', true);
end;
$fn$;

-- ===========================================================================
-- Herkese açık kart — tek kurucu
-- ===========================================================================
-- İstemciye gönderilmeyen veri gizlidir; gönderilip ekranda gizlenen veri
-- gizli değildir. Bu fonksiyon yalnızca persona'da açık olanı döndürür.

create or replace function public.build_public_card(p_profile_id uuid, p_persona_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_p        public.profiles;
  v_x        public.personas;
  v_row      jsonb;
  v_fields   jsonb := '{}'::jsonb;
  v_verified jsonb;
  v_links    jsonb;
  v_orgs     jsonb := '[]'::jsonb;
  v_payment  jsonb;
  v_plan     text;
  v_val      jsonb;
  r          record;
begin
  select * into v_p from public.profiles where id = p_profile_id;
  select * into v_x from public.personas where id = p_persona_id and profile_id = p_profile_id;
  if v_p.id is null or v_x.id is null then
    return null;
  end if;

  if v_x.status = 'paused' then
    return jsonb_build_object('paused', true);
  end if;

  v_row := to_jsonb(v_p);

  for r in
    select c.key, c.value_type, c.base_column, f.field_value
      from public.profile_field_catalog c
      join public.profile_fields f on f.field_key = c.key and f.persona_id = v_x.id
     where c.is_active and f.visibility = 'public'
     order by c.sort_order
  loop
    v_val := case
               when r.field_value is not null and jsonb_typeof(r.field_value) <> 'null' then r.field_value
               when r.base_column is not null then v_row -> r.base_column
             end;
    continue when v_val is null or jsonb_typeof(v_val) = 'null';
    if r.value_type = 'list' then
      continue when jsonb_typeof(v_val) <> 'array' or jsonb_array_length(v_val) = 0;
    else
      continue when jsonb_typeof(v_val) <> 'string' or btrim(v_val #>> '{}') = '';
    end if;
    v_fields := v_fields || jsonb_build_object(r.key, v_val);
  end loop;

  select coalesce(jsonb_agg(f.field_key), '[]'::jsonb) into v_verified
    from public.profile_fields f
   where f.persona_id = v_x.id and f.visibility = 'public' and f.verified_at is not null;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'platform', s.platform, 'url', s.url)
                            order by s.display_order), '[]'::jsonb)
    into v_links
    from public.persona_social_links l
    join public.social_links s on s.id = l.social_link_id
   where l.persona_id = v_x.id and s.url ~* '^https?://';

  if v_x.show_organizations then
    v_plan := coalesce(v_p.subscription_plan, 'free');
    select coalesce(jsonb_agg(t.o), '[]'::jsonb) into v_orgs
      from (
        select jsonb_build_object('id', og.id, 'name', og.name, 'type', og.type,
                                  'description', og.description, 'logo_url', og.logo_url,
                                  'phone', og.phone, 'email', og.email, 'website', og.website,
                                  'address', og.address, 'city', og.city, 'role', m.role) as o
          from public.members m
          join public.organizations og on og.id = m.organization_id
         where m.profile_id = v_p.id
         order by og.name
         limit case when v_plan in ('professional','stk','business','student','corporate') then 999 else 2 end
      ) t;
  end if;

  if v_x.show_payment then
    select jsonb_build_object(
             'bank_accounts', case when coalesce(pp.show_bank_accounts, false) then pp.bank_accounts end,
             'billing_info',  case when coalesce(pp.show_billing_info, false)  then pp.billing_info  end)
      into v_payment
      from public.profile_payment pp where pp.profile_id = v_p.id;
  end if;

  return jsonb_build_object(
    'id',                   v_p.id,
    'username',             v_p.username,
    'name',                 coalesce(v_x.display_name, v_p.name),
    'avatar_url',           coalesce(v_x.avatar_url, v_p.avatar_url),
    'avatar_3d_url',        v_p.avatar_3d_url,
    'background_image_url', v_p.background_image_url,
    'theme_color',          coalesce(v_x.theme_color, v_p.theme_color),
    'theme_style',          v_p.theme_style,
    'referral_code',        v_p.referral_code,
    'fields',               v_fields,
    'verified_fields',      v_verified,
    'social_links',         v_links,
    'organizations',        v_orgs,
    'payment',              v_payment,
    -- vCard ve paylaşım bu adresi kullanır: persona kartı ana karta yönlendirmez.
    'share_path',           case when v_x.is_primary then '/card/' || v_p.username
                                 else '/k/' || v_x.share_code end
  );
end;
$fn$;

revoke all on function public.build_public_card(uuid, uuid) from public, anon, authenticated;

-- Kullanıcı adıyla: ANA persona. İkinci parametre artık ADI değil KODU kabul
-- eder; ad ile başka persona'ya ulaşılamaz.
create or replace function public.get_public_card(p_username text, p_persona text default 'default')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_prof uuid; v_persona uuid;
begin
  if p_username is null or length(p_username) > 100 then
    return null;
  end if;
  if not public.check_rate_limit('card:' || public.request_client_ip(), 120, 600) then
    raise exception 'Cok fazla istek. Lutfen biraz bekleyin.' using errcode = '53400';
  end if;

  select id into v_prof from public.profiles where username = p_username;
  if v_prof is null then return null; end if;

  if p_persona is null or p_persona = 'default' then
    select id into v_persona from public.personas where profile_id = v_prof and is_primary;
  else
    select id into v_persona from public.personas where profile_id = v_prof and share_code = p_persona;
  end if;

  if v_persona is null then return null; end if;
  return public.build_public_card(v_prof, v_persona);
end;
$fn$;

-- Kısa bağlantı: /k/<kod>
create or replace function public.get_public_card_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_x public.personas;
begin
  if p_code is null or length(p_code) > 40 then
    return null;
  end if;
  if not public.check_rate_limit('card:' || public.request_client_ip(), 120, 600) then
    raise exception 'Cok fazla istek. Lutfen biraz bekleyin.' using errcode = '53400';
  end if;

  select * into v_x from public.personas where share_code = p_code;
  if v_x.id is null then return null; end if;
  return public.build_public_card(v_x.profile_id, v_x.id);
end;
$fn$;

revoke all on function public.get_public_card(text, text)     from public;
revoke all on function public.get_public_card_by_code(text)   from public;
grant execute on function public.get_public_card(text, text)   to anon, authenticated;
grant execute on function public.get_public_card_by_code(text) to anon, authenticated;

-- Görüntülenme: persona bazında da sayılır
drop function if exists public.increment_card_view(text);

create or replace function public.increment_card_view(p_username text default null, p_code text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_x public.personas;
begin
  if p_code is not null and length(p_code) <= 40 then
    select * into v_x from public.personas where share_code = p_code;
  elsif p_username is not null and length(p_username) <= 100 then
    select x.* into v_x from public.personas x
      join public.profiles p on p.id = x.profile_id
     where p.username = p_username and x.is_primary;
  end if;
  if v_x.id is null then return; end if;

  if not public.check_rate_limit('view:' || public.request_client_ip() || ':' || v_x.id::text, 10, 3600) then
    return;
  end if;

  update public.personas set view_count = view_count + 1, last_viewed_at = now() where id = v_x.id;
  update public.profiles
     set card_views = coalesce(card_views, 0) + 1, last_viewed_at = now()
   where id = v_x.profile_id;
end;
$fn$;

revoke all on function public.increment_card_view(text, text) from public;
grant execute on function public.increment_card_view(text, text) to anon, authenticated;

-- Ödeme bilgisi doğrudan çağrıda da ana persona ayarına uyar
create or replace function public.get_card_payment_info(p_username text)
returns json
language sql
security definer
set search_path = 'public'
as $fn$
  select json_build_object(
    'bank_accounts', case when coalesce(pp.show_bank_accounts,false) then pp.bank_accounts else null end,
    'billing_info',  case when coalesce(pp.show_billing_info,false)  then pp.billing_info  else null end
  )
  from public.profiles p
  join public.profile_payment pp on pp.profile_id = p.id
  join public.personas x on x.profile_id = p.id and x.is_primary and x.show_payment
  where p.username = p_username;
$fn$;

-- ===========================================================================
-- Yetkiler
-- ===========================================================================

do $mig$
declare f text;
begin
  foreach f in array array[
    'persona_list()', 'persona_editor(uuid)', 'persona_create(text,text,uuid)',
    'persona_update(uuid,jsonb)', 'persona_set_primary(uuid)', 'persona_delete(uuid)',
    'persona_rotate_code(uuid)', 'persona_set_field(uuid,text,text,jsonb,boolean)',
    'persona_set_social_link(uuid,uuid,boolean)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$mig$;
