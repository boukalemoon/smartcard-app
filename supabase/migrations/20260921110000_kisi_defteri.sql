-- ============================================================================
-- KİŞİ DEFTERİ — karşılıklı kartvizit değişimi
-- ============================================================================
--
-- NEDEN (Linktree rakip analizi, 20.09.2026):
--   Linktree'de kartı gören kişi kendi bilgisini bırakabiliyor ve bu kişiler
--   tek bir listede toplanıyor. Kartvizit ürününde bu tek yönlü paylaşımı
--   çift yönlü hale getiriyor: kartı OKUTAN kişi de kendini tanıtıyor.
--   Bizde hiç yoktu; kart sahibi kimin baktığını bilmiyordu.
--
-- KİMİN VERİSİ, KİMİN SORUMLULUĞU:
--   Bilgiyi bırakan ziyaretçi, onu KART SAHİBİNE veriyor. QRtım bu veriyi
--   kart sahibi adına saklar. Bu yüzden:
--     • Form açıkça "bu bilgiler kart sahibine iletilir" der (arayüz).
--     • Ziyaretçi onayı olmadan kayıt oluşmaz (rıza zamanı yazılır).
--     • Kart sahibi listeyi silebilir ve dışa aktarabilir.
--     • Saklama süresi politika tablosuna bağlıdır (süre boşken imha yok).
--   Kimlik numarası, doğum tarihi gibi alanlar BİLEREK yok: kartvizit
--   değişiminde gerekmiyor, istemek de risk.

create table if not exists public.card_contacts (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  persona_id  uuid references public.personas(id) on delete set null,
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  email       text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (phone is null or char_length(phone) between 7 and 25),
  company     text check (company is null or char_length(company) <= 80),
  note        text check (note is null or char_length(note) <= 500),
  source      text check (source is null or source in ('qr','nfc','link','direct')),
  consent_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  -- En az bir iletişim yolu olsun; yoksa kayıt kart sahibine yaramaz.
  constraint card_contacts_iletisim_chk check (email is not null or phone is not null)
);

create index if not exists card_contacts_profile_idx on public.card_contacts (profile_id, created_at desc);

alter table public.card_contacts enable row level security;

-- Kart sahibi yalnızca kendi defterini görür ve siler. Yazma YALNIZCA RPC ile
-- olur (aşağıdaki definer fonksiyon): ziyaretçi tabloya doğrudan yazamaz.
create policy "kart sahibi defterini gorur" on public.card_contacts
  for select to authenticated
  using (profile_id = public.my_profile_id());

create policy "kart sahibi defterinden siler" on public.card_contacts
  for delete to authenticated
  using (profile_id = public.my_profile_id());

revoke insert, update on public.card_contacts from anon, authenticated;

comment on table public.card_contacts is
  'Kartı gören kişinin kendi rızasıyla bıraktığı iletişim bilgisi. Sahibi kart sahibidir; QRtım onun adına saklar.';

-- ---------------------------------------------------------------------------
-- Ziyaretçi bilgisini bırakır (herkese açık, hız sınırlı)
-- ---------------------------------------------------------------------------
create or replace function public.leave_card_contact(
  p_code     text default null,
  p_username text default null,
  p_name     text default null,
  p_email    text default null,
  p_phone    text default null,
  p_company  text default null,
  p_note     text default null,
  p_source   text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_persona uuid; v_prof uuid; v_ip text := public.request_client_ip();
  v_ad text := left(btrim(coalesce(p_name, '')), 80);
  v_eposta text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_tel text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_kaynak text := lower(nullif(btrim(coalesce(p_source, '')), ''));
begin
  if v_kaynak is not null and v_kaynak not in ('qr','nfc','link','direct') then
    v_kaynak := null;
  end if;

  -- Kartı çöz: kod (kalıcı kart kodu veya persona kodu) ya da kullanıcı adı.
  if p_code is not null and length(p_code) <= 40 then
    select r.profil_id, r.persona_id into v_prof, v_persona
      from public.resolve_card_code(p_code) r;
  elsif p_username is not null and length(p_username) <= 100 then
    select id into v_prof from public.profiles where username = p_username;
    if v_prof is null then
      select h.profile_id into v_prof from public.profile_username_history h
       where lower(h.username) = lower(p_username)
       order by h.changed_at desc limit 1;
    end if;
    if v_prof is not null then
      select id into v_persona from public.personas where profile_id = v_prof and is_primary;
    end if;
  end if;

  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'kart_bulunamadi');
  end if;

  if char_length(v_ad) < 2 then
    return jsonb_build_object('ok', false, 'hata', 'ad_gerekli');
  end if;
  if v_eposta is null and v_tel is null then
    return jsonb_build_object('ok', false, 'hata', 'iletisim_gerekli');
  end if;
  if v_eposta is not null and v_eposta !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_eposta');
  end if;

  -- Sel ve taciz koruması: aynı IP'den saatte 5, aynı karta günde 20.
  if not public.check_rate_limit('kisi:' || v_ip, 5, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;
  if not public.check_rate_limit('kisi-kart:' || v_prof::text, 20, 86400) then
    return jsonb_build_object('ok', false, 'hata', 'kart_dolu');
  end if;

  -- Aynı kişi iki kez bırakırsa güncellenir, liste şişmez.
  delete from public.card_contacts
   where profile_id = v_prof
     and ((v_eposta is not null and lower(email) = v_eposta)
          or (v_tel is not null and phone = v_tel));

  insert into public.card_contacts (profile_id, persona_id, name, email, phone, company, note, source)
  values (v_prof, v_persona, v_ad, v_eposta, v_tel,
          nullif(left(btrim(coalesce(p_company, '')), 80), ''),
          nullif(left(btrim(coalesce(p_note, '')), 500), ''),
          v_kaynak);

  -- Kart sahibi kendi etkinlik geçmişinde görür.
  perform public.log_event('card.contact_left', null, 'qrtim', 'card_contact', v_prof::text,
                           'success', 'notice', 'user',
                           jsonb_build_object('kaynak', v_kaynak),
                           'service', null, null, null,
                           (select user_id from public.profiles where id = v_prof));

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.leave_card_contact(text,text,text,text,text,text,text,text) from public;
grant execute on function public.leave_card_contact(text,text,text,text,text,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Kart sahibinin defteri
-- ---------------------------------------------------------------------------
create or replace function public.my_card_contacts(p_from timestamptz default null,
                                                   p_to   timestamptz default null)
returns table (id uuid, name text, email text, phone text, company text, note text,
               source text, persona_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select c.id, c.name, c.email, c.phone, c.company, c.note, c.source,
         coalesce(x.display_name, x.name), c.created_at
    from public.card_contacts c
    left join public.personas x on x.id = c.persona_id
   where c.profile_id = public.my_profile_id()
     and (p_from is null or c.created_at >= date_trunc('day', p_from))
     and (p_to   is null or c.created_at <  date_trunc('day', p_to) + interval '1 day')
   order by c.created_at desc;
$fn$;

revoke all on function public.my_card_contacts(timestamptz,timestamptz) from public, anon;
grant execute on function public.my_card_contacts(timestamptz,timestamptz) to authenticated;

-- Saklama politikası: süre hukuki teyitle girilecek (boşken imha yok).
insert into public.data_retention_policies (key, description, legal_basis, action_patterns)
values ('kisi_defteri',
        'Kart sahibinin defterinde tutulan, ziyaretçinin kendi rızasıyla bıraktığı iletişim bilgileri',
        'KVKK md. 5/1 açık rıza (ziyaretçi bilgisini kendisi bırakır); amaç: kartvizit değişimi',
        '{card.contact%}')
on conflict (key) do nothing;
