-- ============================================================================
-- ADIM 5d — YENİ FONKSİYONLARIN SIKILAŞTIRILMASI
-- ============================================================================
--
-- Supabase güvenlik danışmanının 5c sonrası verdiği üç bulgu:
--
-- 1) audit_log_guard ve user_sync_data_guard'da search_path sabit değil.
--    Bu projede daha önce de düzelttiğimiz sınıf: search_path'i ele geçiren
--    biri fonksiyonun çağırdığı adları kendi şemasına yönlendirebilir.
--
-- 2) Tetikleyici fonksiyonları REST üzerinden RPC olarak çağrılabiliyor
--    (/rest/v1/rpc/audit_row_change). Tetikleyici bağlamı dışında çağrılınca
--    hata verirler, yani sömürülebilir değiller — ama API yüzeyinde
--    görünmelerinin hiçbir gerekçesi yok.
--
-- 3) YENİ RPC'ler anon'a da açık. Sebep: PostgreSQL yeni fonksiyonlara
--    varsayılan olarak PUBLIC'e EXECUTE verir; ben yalnızca authenticated'a
--    GRANT ettim ama PUBLIC'ten REVOKE etmedim. Test ettiğimde hepsi
--    'oturum_yok' döndürüyor (auth.uid() null olduğu için), yani sızıntı
--    yok — ama kimliksiz çağrının API'de görünmesi gereksiz.
--
-- get_public_card / increment_card_view / get_public_organization /
-- get_public_org_members BİLEREK anon'a açık kalıyor: herkese açık kartvizit
-- sayfasının tek veri yolu bunlar.

-- ---------------------------------------------------------------------------
-- 1) Tetikleyici fonksiyonlarında search_path sabitle
-- ---------------------------------------------------------------------------

create or replace function public.audit_log_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'UPDATE' then
    raise exception 'audit_log satirlari degistirilemez (salt-ekleme)'
      using errcode = '42501';
  end if;

  if old.occurred_at > now() - interval '90 days' then
    raise exception 'audit_log satiri saklama suresi dolmadan silinemez (%)', old.occurred_at
      using errcode = '42501';
  end if;

  return old;
end;
$fn$;

create or replace function public.user_sync_data_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  new.size_bytes := pg_column_size(new.payload);
  if new.size_bytes > 5 * 1024 * 1024 then
    raise exception 'senkron verisi 5 MB sinirini asiyor (% bayt)', new.size_bytes
      using errcode = '22001';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2) Tetikleyici fonksiyonlarını API yüzeyinden çek
-- ---------------------------------------------------------------------------
-- PostgreSQL tetikleyiciyi çalıştırırken çağıran kullanıcının EXECUTE
-- yetkisine BAKMAZ; bu yüzden revoke tetikleyicileri bozmaz.

revoke all on function public.audit_row_change()        from public, anon, authenticated;
revoke all on function public.audit_log_guard()         from public, anon, authenticated;
revoke all on function public.user_sync_data_guard()    from public, anon, authenticated;
revoke all on function public.sync_org_member_count()   from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Yeni RPC'leri anon'a kapat
-- ---------------------------------------------------------------------------

revoke all on function public.app_connect(text, text[])                  from public, anon;
revoke all on function public.app_disconnect(text)                       from public, anon;
revoke all on function public.set_preferences(jsonb, text)               from public, anon;
revoke all on function public.get_preferences(text)                      from public, anon;
revoke all on function public.sync_pull(text, text)                      from public, anon;
revoke all on function public.sync_push(text, text, jsonb, bigint)       from public, anon;
revoke all on function public.my_activity(int, int)                      from public, anon;

grant execute on function public.app_connect(text, text[])                to authenticated;
grant execute on function public.app_disconnect(text)                     to authenticated;
grant execute on function public.set_preferences(jsonb, text)             to authenticated;
grant execute on function public.get_preferences(text)                    to authenticated;
grant execute on function public.sync_pull(text, text)                    to authenticated;
grant execute on function public.sync_push(text, text, jsonb, bigint)     to authenticated;
grant execute on function public.my_activity(int, int)                    to authenticated;
