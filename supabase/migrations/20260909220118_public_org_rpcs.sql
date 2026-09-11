-- ============================================================================
-- FAZ 1 / ADIM 2 — Kurum ve üye dizini için sunucu tarafı kapılar (EKLEYİCİ)
-- ============================================================================
--
-- Bu migration da mevcut siteyi ETKİLEMEZ; yalnızca yeni fonksiyon ekler.
--
-- NEDEN:
--   /org/:id/members ve /org/:id/apply sayfaları bugün anon anahtarla
--   doğrudan tablo okuyor:
--     supabase.from('organizations').select('*').eq('id', orgSlug)
--     supabase.from('members').select('*').eq('organization_id', ...)
--
--   Üç ayrı sorun:
--   1) 'Sadece STK' kısıtı İSTEMCİDE. Saldırgan tabloyu doğrudan sorgular,
--      33 kurumun tamamını (telefon/e-posta/adres) ve 9 üyelik kaydını alır.
--   2) members.select('*') her üyenin AD, E-POSTA ve TELEFONUNU yayımlıyor.
--   3) Kurum ayarlarındaki memberVisibility / allowPublicDirectory tercihleri
--      HİÇBİR YERDE uygulanmıyor (bulgu Y-2).
--
-- Ayrıca iki mevcut veri hatasına tolerans eklendi:
--   • Bazı satırlarda değerler tırnakla kaydedilmiş ("'active'", "'Üye'"),
--     bu yüzden .eq('status','active') hiçbir satırı tutmuyordu.
--   • Kurum tipleri karışık: 'dernek' (TR) ile 'association' (EN) bir arada.

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

-- Tırnakla kaydedilmiş metinleri normalize eder: "'active'" -> "active"
create or replace function public.unquote_text(p text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(btrim(coalesce(p, '')), ''''), '');
$$;

-- Üye dizini/başvuru açabilen kurum tipleri (TR + EN yazımlar birlikte)
create or replace function public.is_stk_org_type(p_type text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(coalesce(public.unquote_text(p_type), '')) in (
    'association','foundation','community','union',
    'dernek','vakif','vakıf','topluluk','sendika','stk'
  );
$$;

-- ---------------------------------------------------------------------------
-- 1) Kurumun herkese açık künyesi
-- ---------------------------------------------------------------------------
-- Yalnızca STK tipi kurumlar döner; şirketler için null. Tip kontrolü artık
-- SUNUCUDA. Dönen alanlar kurum künyesiyle sınırlı — ayarlar, abonelik ve
-- iç alanlar dışarı verilmez.

create or replace function public.get_public_organization(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_o public.organizations%rowtype;
begin
  if p_org_id is null then return null; end if;

  select * into v_o from public.organizations where id = p_org_id;
  if not found then return null; end if;

  if not public.is_stk_org_type(v_o.type) then
    return null;                      -- şirket vb. => herkese açık sayfa yok
  end if;

  return jsonb_build_object(
    'id',          v_o.id,
    'name',        public.unquote_text(v_o.name),
    'type',        public.unquote_text(v_o.type),
    'description', public.unquote_text(v_o.description),
    'logo_url',    v_o.logo_url,
    'website',     v_o.website,
    'city',        public.unquote_text(v_o.city),
    'theme_color', v_o.theme_color,
    -- Sayfanın hangi bölümleri gösterileceğini istemci bu bayraklarla bilir.
    'allow_public_directory',
      coalesce((v_o.settings->>'allowPublicDirectory')::boolean, false),
    'auto_approve',
      coalesce((v_o.settings->>'autoApprove')::boolean, false)
  );
end;
$$;

revoke all on function public.get_public_organization(uuid) from public;
grant execute on function public.get_public_organization(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Üye dizini
-- ---------------------------------------------------------------------------
-- Kurumun kendi tercihleri artık GERÇEKTEN uygulanıyor:
--   allowPublicDirectory = false      -> boş liste
--   memberVisibility     = members_only -> boş liste (herkese açık sayfada)
--
-- DAVRANIŞ DEĞİŞİKLİĞİ: Üye e-postası ve telefonu artık varsayılan olarak
-- YAYIMLANMAZ. Kurum bunları göstermek isterse settings.showMemberContact
-- alanını true yapmalıdır. Gerekçe: bir dernek üyesi olmak, iletişim
-- bilgisinin herkese açılmasına rıza göstermek değildir (KVKK).

create or replace function public.get_public_org_members(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_o            public.organizations%rowtype;
  v_show_contact boolean;
  v_rows         jsonb;
begin
  if p_org_id is null then return '[]'::jsonb; end if;

  select * into v_o from public.organizations where id = p_org_id;
  if not found then return '[]'::jsonb; end if;

  if not public.is_stk_org_type(v_o.type) then
    return '[]'::jsonb;
  end if;

  if not coalesce((v_o.settings->>'allowPublicDirectory')::boolean, false) then
    return '[]'::jsonb;
  end if;

  if lower(coalesce(v_o.settings->>'memberVisibility', 'members_only')) <> 'public' then
    return '[]'::jsonb;
  end if;

  v_show_contact := coalesce((v_o.settings->>'showMemberContact')::boolean, false);

  select coalesce(jsonb_agg(r order by r->>'name'), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
             'id',    m.id,
             'name',  public.unquote_text(m.name),
             'role',  public.unquote_text(m.role),
             'email', case when v_show_contact then public.unquote_text(m.email) end,
             'phone', case when v_show_contact then public.unquote_text(m.phone) end
           ) as r
    from public.members m
    where m.organization_id = p_org_id
      -- Tırnaklı kaydedilmiş status değerlerine tolerans
      and lower(coalesce(public.unquote_text(m.status), 'active')) = 'active'
  ) t;

  return v_rows;
end;
$$;

revoke all on function public.get_public_org_members(uuid) from public;
grant execute on function public.get_public_org_members(uuid) to anon, authenticated;

comment on function public.get_public_org_members(uuid) is
  'Üye dizini. Kurumun allowPublicDirectory/memberVisibility tercihlerini SUNUCUDA uygular; iletişim bilgisi yalnızca showMemberContact=true ise döner.';
