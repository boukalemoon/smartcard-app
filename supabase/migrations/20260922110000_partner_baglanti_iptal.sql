-- ============================================================================
-- PARTNER BAĞLANTI İPTALİ: "hesap yok" ile "yetkisiz" ayrıldı
-- ============================================================================
--
-- SORU (Arku, 22.09.2026): QRtım hesabı SİLİNİRSE partner-plan ne döner?
-- Partnerin iki durumu ayırması şart:
--   • "hesap yok / artık ücretli değil"  → yetkiyi HEMEN düşür
--   • "geçici erişilemezlik"             → son bilinen planı kısa süre koru
-- İkisi aynı cevabı verirse geçici bir QRtım arızası bütün ücretli
-- kullanıcıları düşürür; ya da tersi, gerçek bir iptal görmezden gelinir.
--
-- ÖLÇÜLEN DURUM: partner_user_links ve qrtim_user_ids'in İKİSİ de auth.users'a
-- ON DELETE CASCADE bağlı ve hesap silme gerçekten "delete from auth.users"
-- yapıyor. Yani silinen hesapta her iki kayıt da yok oluyordu ve fonksiyon
-- "yetkisiz" dönüyordu — YANLIŞ SIR ile ayırt edilemez biçimde.
--
-- NEDEN BASİTÇE AYIRMADIK: "kimlik yok" ile "sır yanlış" bilerek aynı cevaba
-- indirgenmişti, çünkü ayırmak kimlik numaralandırmaya kapı açar: elinde TEK
-- geçerli sır olan biri istediği qrtim_uid'i yollayıp "var mı yok mu"
-- öğrenebilirdi.
--
-- ÇÖZÜM: SIR KİMLİĞİN KENDİSİDİR. Bağ önce SIRLA aranır. "İptal edildi"
-- cevabını ancak bir zamanlar GEÇERLİ olmuş bir sır sunan alabilir; elinde
-- sır olmayan için hiçbir şey değişmez.
--
-- İZ KAYDI KİŞİSEL VERİ TAŞIMAZ: yalnızca sırrın tek yönlü ÖZETİ, partner adı
-- ve zaman. Kullanıcı kimliği, e-posta, ad yok. Ham sır saklanmadığı için
-- kayıt bir kimlik bilgisi olarak da kullanılamaz.

create table if not exists public.partner_link_revocations (
  partner     text not null check (partner ~ '^[a-z0-9_-]{2,32}$'),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  revoked_at  timestamptz not null default now(),
  reason      text,
  primary key (partner, secret_hash)
);

alter table public.partner_link_revocations enable row level security;
revoke all on public.partner_link_revocations from anon, authenticated;

comment on table public.partner_link_revocations is
  'Iptal edilmis partner baglantilari. Yalnizca sirrin tek yonlu ozeti tutulur; kullanici kimligi ya da kisisel veri YOKTUR.';

-- Bağ satırı silindiğinde iz bırak. ON DELETE CASCADE da satır tetikleyicisini
-- çalıştırır, yani hesap silme yoluyla gelen temizlik de yakalanır.
create or replace function public.partner_link_revoke_trace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.partner_link_revocations (partner, secret_hash, reason)
  values (old.partner,
          encode(extensions.digest(old.link_secret, 'sha256'), 'hex'),
          'baglanti_kaldirildi')
  on conflict (partner, secret_hash) do nothing;
  return old;
end;
$fn$;

revoke all on function public.partner_link_revoke_trace() from public, anon, authenticated;

drop trigger if exists partner_link_revoke_trace_trg on public.partner_user_links;
create trigger partner_link_revoke_trace_trg
  before delete on public.partner_user_links
  for each row execute function public.partner_link_revoke_trace();

-- ---------------------------------------------------------------------------
-- partner_effective_plan: sıralama değişti
-- ---------------------------------------------------------------------------
-- Bağ artık önce SIRLA aranıyor (kimliğin kendisi sır). Sunulan qrtim_uid
-- yalnızca TUTARLILIK kontrolü: partnerin sakladığı eşleşme bozulmuşsa
-- yakalanır ve plan döndürülmez.
--
-- Hız sınırı da öne alındı ve KİMLİK BAŞINA anahtarlandı (sırrın özeti):
-- eskiden yalnızca doğrulama geçtikten sonra sayıyordu, yani başarısız
-- denemeler hiç sınırlanmıyordu.
create or replace function public.partner_effective_plan(
  p_partner     text,
  p_qrtim_uid   text,
  p_link_secret text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid; v_prof uuid; v_plan text; v_bitis timestamptz;
  v_pf public.plan_features; v_ozet text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;

  if p_partner is null or p_partner !~ '^[a-z0-9_-]{2,32}$'
     or p_qrtim_uid is null
     or p_qrtim_uid !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_link_secret is null or p_link_secret !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_istek');
  end if;

  v_ozet := encode(extensions.digest(p_link_secret, 'sha256'), 'hex');

  if not public.check_rate_limit('partner-plan:' || p_partner || ':' || left(v_ozet, 16), 60, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  -- 1) Canlı bağ — SIRLA aranır.
  select l.user_id into v_user
    from public.partner_user_links l
   where l.partner = p_partner and l.link_secret = p_link_secret;

  if v_user is null then
    -- 2) Bir zamanlar geçerliydi ve iptal edildi mi?
    if exists (select 1 from public.partner_link_revocations r
                where r.partner = p_partner and r.secret_hash = v_ozet) then
      return jsonb_build_object('ok', false, 'hata', 'baglanti_iptal');
    end if;
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if not exists (select 1 from public.qrtim_user_ids q
                  where q.user_id = v_user and q.qrtim_uid = p_qrtim_uid::uuid) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  -- profiles.id ≠ user_id (34 profilin 7'sinde farklı) — doğru kolondan.
  select id into v_prof from public.profiles where user_id = v_user;

  select s.plan, s.expires_at into v_plan, v_bitis
    from public.subscriptions s
   where s.profile_id = v_prof
     and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc
   limit 1;

  v_plan := coalesce(v_plan, 'free');
  select * into v_pf from public.plan_features where plan = v_plan;

  update public.partner_user_links
     set last_seen = now()
   where user_id = v_user and partner = p_partner;

  perform public.log_event('partner.plan_checked', null, p_partner,
                           'subscription', v_prof::text, 'success', 'info', 'internal',
                           jsonb_build_object('plan', v_plan),
                           'service', null, null, null, v_user);

  return jsonb_build_object(
    'ok', true,
    'plan', v_plan,
    'expires_at', v_bitis,
    'max_sync_devices', coalesce(v_pf.sync_max_devices, 1),
    'password_sync', coalesce(v_pf.sync_passwords, false),
    'kontrol_zamani', now());
end;
$fn$;

revoke all on function public.partner_effective_plan(text, text, text) from public, anon, authenticated;
grant execute on function public.partner_effective_plan(text, text, text) to service_role;

-- DOĞRULANDI (geri alınan işlemde):
--   canlı bağ → plan · sır doğru ama kimlik tutmuyor → yetkisiz ·
--   hiç var olmamış sır → yetkisiz · bağ silinince iz bırakıldı ·
--   kopmuş bağlantı → baglanti_iptal (ayırt edilebiliyor) ·
--   ham sır iz kaydında YOK (yalnızca özet).
