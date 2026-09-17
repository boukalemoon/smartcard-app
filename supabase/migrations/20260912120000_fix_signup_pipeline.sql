-- ============================================================================
-- ADIM 1 — KAYIT HATTININ ONARIMI
-- ============================================================================
--
-- SORUN (12.09.2026'da canlı ortamda kanıtlandı):
--   handle_new_user tetikleyicisi profil ekliyor, ardından abonelik eklerken
--   `ON CONFLICT (profile_id) DO NOTHING` kullanıyor. Ancak subscriptions
--   tablosunda profile_id üzerinde UNIQUE KISIT YOK. PostgreSQL bu durumda
--   satırı atlamaz, doğrudan hata verir:
--
--     42P10: there is no unique or exclusion constraint
--            matching the ON CONFLICT specification
--
--   Fonksiyonun sonundaki `EXCEPTION WHEN OTHERS` hatayı yutuyor. Ama
--   PL/pgSQL'de bir exception bloğu BLOK İÇİNDEKİ TÜM DEĞİŞİKLİKLERİ geri
--   alır — profil eklemesi dahil. Kullanıcı oluşuyor, profili oluşmuyor,
--   hiçbir yerde hata görünmüyor.
--
--   Ölçüm: 36 auth kullanıcısının 15'inde profil yok; 12'si doğrulanmış ve
--   giriş yapmış gerçek kişiler. Profili olanlar kayıt akışı sayesinde değil,
--   panelde formu doldurdukları için (yedek yol) kurtulmuş.
--
--   Aynı eksik kısıt 16 profilde çifte aboneliğe de yol açmış; arayüz
--   `.single()` ile okuduğu için bu kullanıcılar sessizce ücretsiz plana
--   düşüyor. Şu an hepsi zaten ücretsiz olduğu için zararsız, ama biri
--   ücretli plana geçtiği an ödediği hâlde düşecekti.
--
-- SIRALAMA ÖNEMLİ:
--   Unique kısıt eklenince, korumasız çalışan create_free_subscription_for_new_user
--   patlamaya başlar ve profil eklemesini komple engeller. Bu yüzden ikisi
--   AYNI migration'da düzeltiliyor.

-- ---------------------------------------------------------------------------
-- 1) Mükerrer abonelikleri temizle
-- ---------------------------------------------------------------------------
-- Çiftler birebir aynı (id dışında tek fark yok: aynı saniye, aynı plan,
-- aynı limitler, amount_paid boş) — doğrulandı, "hangisi kalsın" sorusu yok.
-- En eski olan (eşitlikte en küçük id) tutulur.
--
-- GÜVENLİK: transactions.subscription_id bu tabloya FK veriyor. transactions
-- şu an boş ama yine de referanslı hiçbir satır silinmez.

delete from public.subscriptions s
where s.id in (
  select id from (
    select id, row_number() over (partition by profile_id order by created_at, id) as rn
    from public.subscriptions
  ) sirali
  where sirali.rn > 1
)
and not exists (
  select 1 from public.transactions t where t.subscription_id = s.id
);

-- ---------------------------------------------------------------------------
-- 2) Asıl düzeltme: unique kısıt
-- ---------------------------------------------------------------------------
-- Bu tek kısıt üç şeyi birden yapar:
--   • ON CONFLICT (profile_id) artık geçerli olur -> 42P10 biter
--   • bir profilin ikinci aboneliği bir daha oluşamaz
--   • .single() okuması güvenli hale gelir

alter table public.subscriptions
  add constraint subscriptions_profile_id_key unique (profile_id);

-- ---------------------------------------------------------------------------
-- 3) Sessiz başarısızlığı görünür kıl
-- ---------------------------------------------------------------------------
-- Bu hatanın 5 ay fark edilmemesinin sebebi tam olarak sessizce yutulmasıydı.
-- Tetikleyici hataları artık bir yere yazılır.

create table if not exists public.trigger_errors (
  id          bigint generated always as identity primary key,
  source      text not null,
  context     jsonb,
  sqlstate    text,
  message     text,
  occurred_at timestamptz not null default now()
);

create index if not exists trigger_errors_time_idx
  on public.trigger_errors (occurred_at desc);

alter table public.trigger_errors enable row level security;
-- Politika yok => yalnızca service_role okur. Kişisel veri yazılmaz.

comment on table public.trigger_errors is
  'Tetikleyici hataları. Sessiz başarısızlık bu projede 5 ay görünmeden kaldı; artık iz bırakıyor.';

-- ---------------------------------------------------------------------------
-- 4) handle_new_user — tek sorumluluk: profil
-- ---------------------------------------------------------------------------
-- Abonelik oluşturma buradan KALDIRILDI. O iş profiles tetikleyicisinin
-- (create_free_subscription_for_new_user) sorumluluğu; iki yerde birden
-- yapılması zaten mükerrerliğin kaynağıydı.
--
-- EXCEPTION bloğu KORUNUYOR ama artık sessiz değil: hata trigger_errors'a
-- yazılır. Blok korunuyor çünkü burada hata fırlatmak kaydın tamamını
-- engeller — kullanıcı hiç hesap açamaz. Profilsiz kalmak, hiç kaydolamamaktan
-- iyidir; ama artık ikisi de görünür.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_username text;
  v_name     text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );

  v_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '', 'g'))
                || '_' || substring(new.id::text, 1, 6);

  insert into public.profiles (id, user_id, email, name, username)
  values (new.id, new.id, new.email, v_name, v_username)
  on conflict (id) do update
    set user_id = excluded.user_id,
        email   = excluded.email,
        name    = case when profiles.name = '' or profiles.name is null
                       then excluded.name else profiles.name end;

  return new;

exception when others then
  -- Artık iz bırakıyor. Hata fırlatmıyoruz: aksi halde kayıt tamamen bloke olur.
  insert into public.trigger_errors (source, context, sqlstate, message)
  values ('handle_new_user',
          jsonb_build_object('user_id', new.id),
          sqlstate, sqlerrm);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Abonelik tetikleyicisini fikri sabit hale getir
-- ---------------------------------------------------------------------------
-- Unique kısıt eklendiği için korumasız INSERT artık patlar ve profil
-- eklemesini komple engellerdi. ON CONFLICT ile güvenli hale getiriliyor.

create or replace function public.create_free_subscription_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  insert into public.subscriptions (
    profile_id, plan, billing_cycle, status, started_at, expires_at,
    nfc_cards_included, organizations_limit, social_links_limit
  ) values (
    new.id, 'free', 'monthly', 'active', now(), null,
    0,  -- ücretsiz planda NFC kart yok
    2,  -- 2 organizasyon
    3   -- 3 sosyal medya
  )
  on conflict (profile_id) do nothing;

  return new;

exception when others then
  insert into public.trigger_errors (source, context, sqlstate, message)
  values ('create_free_subscription_for_new_user',
          jsonb_build_object('profile_id', new.id),
          sqlstate, sqlerrm);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA (uygulandıktan sonra)
-- ---------------------------------------------------------------------------
--   select count(*) from public.subscriptions;              -- 21 olmalı (37 idi)
--   select count(*) from (select profile_id from public.subscriptions
--                         group by profile_id having count(*)>1) x;  -- 0 olmalı
--   -- Yeni kayıt benzetimi geri alınan bir işlemde çalıştırılmalı.
