-- ============================================================================
-- Arku bağlantı süreleri BULUTTA TUTULMUYOR — 20261019
-- ============================================================================
--
-- 20261018130000 bağlantı sürelerini QRtım'de saklayacak bir tablo kurmuştu
-- (partner_remote_sessions + bildirim RPC'si + saklama işi). YANLIŞ OKUMA:
-- "QRtım üzerinden bağlandığı sürenin bilgisini alabilmek" cümlesini sunucuda
-- saklama olarak anlamışım.
--
-- Kurucunun tasarımı (19.10.2026): süre geçmişi bağlantıyı KURAN ve erişim
-- SAĞLAYAN kişinin KENDİ bilgisayarında kayıtlı kalır; bulutta hiçbir veri
-- olmaz. Bu yüzden saklama tarafı tamamen kaldırılıyor.
--
-- KALAN: partner_user_links.remote_id — paylaşılabilir bağlantı kimliği.
-- İstenen buydu ve duruyor. Arku kimliği bildirir, QRtım gösterir; süreyi
-- bildirmez, QRtım saklamaz.
--
-- Sırayla düşürülüyor: önce zamanlanmış iş, sonra ona bağlı fonksiyon, sonra
-- tabloya bağlı RPC, en son tablo.

-- 1) Zamanlanmış temizlik işi
--
-- cron.job tablosuna DOĞRUDAN delete atılmaz: tablo sahibi değiliz,
-- "permission denied for table job" verir. pg_cron'da işi kaldırmanın yolu
-- cron.unschedule(). İş yoksa hata fırlatır, bu yüzden varlığı önce
-- denetleniyor (migration iki kez çalıştırılabilsin).
do $kaldir$
begin
  if exists (select 1 from cron.job where jobname = 'qrtim-uzak-oturum-saklama') then
    perform cron.unschedule('qrtim-uzak-oturum-saklama');
  end if;
end $kaldir$;

-- 2) Temizlik fonksiyonu
drop function if exists public.prune_remote_sessions();

-- 3) Partnerin oturum bildirdiği uç — artık bildirilecek bir şey yok
drop function if exists public.partner_remote_session_report(
  text, text, text, text, timestamptz, timestamptz, text);

-- 4) Oturum tablosu
drop table if exists public.partner_remote_sessions;

-- 5) Saklama politikası satırı: saklanan veri kalmadı
delete from public.data_retention_policies where key = 'uzak_baglanti_oturumlari';

-- ---------------------------------------------------------------------------
-- 6) Panelin okuduğu özet: yalnızca bağlantı kimliği
-- ---------------------------------------------------------------------------
-- Oturum sayısı/süresi alanları KALDIRILDI. Arayüz artık yalnız kimliği
-- gösteriyor; süre Arku'nun kendi ekranında, kullanıcının bilgisayarında.
create or replace function public.my_remote_baglanti(p_partner text default 'arku')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kimlik text;
  v_gorulme timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;
  if p_partner is null or p_partner !~ '^[a-z0-9_-]{2,32}$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_istek');
  end if;

  select l.remote_id, l.last_seen into v_kimlik, v_gorulme
    from public.partner_user_links l
   where l.user_id = auth.uid() and l.partner = p_partner;

  return jsonb_build_object(
    'ok', true,
    'baglanti_kimligi', v_kimlik,     -- null ise partner henüz bildirmedi
    'son_gorulme', v_gorulme
  );
end;
$$;

revoke all on function public.my_remote_baglanti(text) from public, anon;
grant execute on function public.my_remote_baglanti(text) to authenticated;

comment on function public.my_remote_baglanti(text) is
  'Kisinin kendi uzak baglanti kimligi. Baglanti SURESI QRtim de TUTULMAZ: kullanicinin kendi bilgisayarinda kalir (kurucu karari 19.10.2026).';

-- ---------------------------------------------------------------------------
-- 7) Bağlantı kimliğini partner nasıl bildirecek?
-- ---------------------------------------------------------------------------
-- Eski bildirim RPC'si oturum da alıyordu; kimlik için sade bir uç kalıyor.
-- Kullanıcı PARAMETREYLE ALINMAZ: link_secret üçlüsünden çözülür, böylece
-- partner başkasının adına kimlik yazamaz (partner_effective_plan ile aynı
-- desen; Arku'da O3 olarak düzeltilen hatanın tekrarlanmaması için).
create or replace function public.partner_remote_id_report(
  p_partner     text,
  p_qrtim_uid   text,
  p_link_secret text,
  p_remote_id   text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid; v_n int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;

  if p_partner is null or p_partner !~ '^[a-z0-9_-]{2,32}$'
     or p_qrtim_uid is null
     or p_qrtim_uid !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_link_secret is null or p_link_secret !~ '^[0-9a-f]{64}$'
     or p_remote_id is null
     or p_remote_id !~ '^[A-Za-z0-9][A-Za-z0-9 _-]{2,63}$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_istek');
  end if;

  select l.user_id into v_user
    from public.partner_user_links l
    join public.qrtim_user_ids q on q.user_id = l.user_id
   where l.partner = p_partner
     and q.qrtim_uid = p_qrtim_uid::uuid
     and l.link_secret = p_link_secret;

  if v_user is null then
    return jsonb_build_object('ok', false, 'hata', 'baglanti_yok');
  end if;

  update public.partner_user_links
     set remote_id = p_remote_id, last_seen = now()
   where partner = p_partner and user_id = v_user;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'hata', 'baglanti_yok');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.partner_remote_id_report(text,text,text,text)
  from public, anon, authenticated;

comment on function public.partner_remote_id_report(text,text,text,text) is
  'Partner paylasilabilir baglanti kimligini bildirir. Yalniz service_role. Kullanici link_secret ten cozulur. SURE BILGISI ALINMAZ.';
