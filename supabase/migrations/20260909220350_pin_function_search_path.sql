-- ============================================================================
-- FAZ 2 / ADIM 3 — Fonksiyonlarda search_path sabitlenmesi (bulgu O-9)
-- ============================================================================
--
-- SORUN:
--   `public` şemasındaki ~30 fonksiyonda `search_path` sabitlenmemiş. Bu,
--   Supabase güvenlik danışmanının da uyardığı bir durum: SECURITY DEFINER
--   bir fonksiyon çağrıldığında şema arama yolu çağıranın oturumundan
--   gelirse, saldırgan kendi şemasında sahte bir tablo/fonksiyon tanımlayıp
--   fonksiyonun onu çağırmasını sağlayabilir (search_path ele geçirme).
--
-- NEDEN `public, pg_temp` — NEDEN BOŞ DEĞİL:
--   En sıkı ayar `search_path = ''`tır; ancak o zaman fonksiyon gövdesindeki
--   HER nesne adının şema ile nitelenmiş olması gerekir (`public.profiles`).
--   Mevcut fonksiyonların gövdelerini görmediğimiz için boş search_path
--   niteliksiz ad kullanan her fonksiyonu ANINDA BOZARDI.
--
--   `public, pg_temp` ise bugünkü çözümleme davranışını korur (varsayılan
--   arama yolu zaten `"$user", public` idi) ama yolu sabitler; çağıranın
--   oturumu artık etkileyemez. Yani davranış değişmez, açık kapanır.
--
--   Bu migration'da yeni yazdığımız fonksiyonlara dokunulmaz: onlar zaten
--   `set search_path = ''` ile ve tam nitelenmiş adlarla yazıldı.
--
-- KAPSAM:
--   Yalnızca `public` şemasındaki, HİÇ search_path ayarı olmayan fonksiyonlar.
--   Ayarı zaten olan hiçbir fonksiyon değiştirilmez.

do $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')            -- fonksiyon + prosedür
      and (
        p.proconfig is null
        or not exists (
          select 1 from unnest(p.proconfig) as c where c like 'search_path=%'
        )
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
    v_count := v_count + 1;
  end loop;

  raise notice 'search_path sabitlenen fonksiyon sayısı: %', v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA
-- ---------------------------------------------------------------------------
-- Aşağıdaki sorgu 0 satır dönmelidir (search_path'i olmayan fonksiyon kalmadı):
--
--   select p.oid::regprocedure
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prokind in ('f','p')
--     and (p.proconfig is null
--          or not exists (select 1 from unnest(p.proconfig) c
--                         where c like 'search_path=%'));
--
-- GERİ ALMA (tek bir fonksiyon için):
--   alter function public.<ad>(<imza>) reset search_path;
