-- ============================================================================
-- Partner hak edişi: sabit tutar yerine ORAN (%10), öğrenci dahil
-- ============================================================================
--
-- BOZUK OLAN:
--   update_referral_on_subscription üç yerde yanlıştı.
--   1) Kapı `new.plan in ('professional','stk','business')` idi: ÖĞRENCİ PLANI
--      HİÇ GİRMİYORDU. Arkadaşını getiren öğrenci sıfır hak ediş kazanıyordu —
--      oysa öğrenci büyümesi bu kurguya dayanıyor.
--   2) Tutar sabitti: 50 / 75 / 150 ₺. Panel "%10 hak ediş" yazıyor. Yeni
--      fiyatlarla sabit tutarlar %27-31'e çıkmıştı (Profesyonel 159 ₺ → 50 ₺).
--   3) Yalnız ücretsizden ücretliye İLK geçişte doğuyordu (old.plan = 'free');
--      yenilemelerde hiç doğmuyordu. Panel ise "ödeme gerçekleştikçe
--      hesabınıza yazılır" diyor.
--   Tetikleyici AFTER UPDATE idi; abonelik satırı INSERT ile doğarsa da
--   kaçırıyordu.
--
-- ÖLÇÜM (18.10.2026): commissions 0, referrals 0, payment_intents 0 satır.
-- Ödeme altyapısı henüz açık olmadığı için bu mantık üretimde HİÇ çalışmamış;
-- düzeltilecek veri yok, geriye dönük hesap yok.
--
-- ORAN KODDA DEĞİL TABLODA: depodaki commission_rates deseni ("Fiyat
-- revizyonunda BURASI degisir, kod degil"). Plan başına ayrı satır var ki
-- öğrenciyi teşvik etmek için oranı yalnız orada yükseltebilsin.
--
-- KOMİSYON TABANI: ödenen tutardan KARTA giden kısım düşülür. Fiziksel kartın
-- gerçek maliyeti var; donanıma %10 vermek marjı yer. Taban, aynı plan ve
-- dönemin kartsız fiyatıdır ve hiçbir zaman fiilen ödenen tutarı aşamaz.
--
-- YÖNETİCİ ELLE PLAN VERİRSE KOMİSYON DOĞMAZ: aynı işlemde "hak tanındı"
-- işaretli bir ödeme niyeti aranır (eski düzeltmenin koruduğu kural; kanıt
-- o migration'ın notunda: ödeme yapmayan test hesabı komisyon doğuruyordu).

-- ---------------------------------------------------------------------------
-- 1) Oran tablosu
-- ---------------------------------------------------------------------------
create table if not exists public.referral_commission_rates (
  plan       text primary key,
  oran       numeric(5,4) not null check (oran >= 0 and oran <= 1),
  aciklama   text,
  updated_at timestamptz not null default now()
);

alter table public.referral_commission_rates enable row level security;
revoke all on public.referral_commission_rates from anon, authenticated;
grant select on public.referral_commission_rates to authenticated;

drop policy if exists "oranlari herkes okur" on public.referral_commission_rates;
create policy "oranlari herkes okur" on public.referral_commission_rates
  for select to authenticated using (true);

comment on table public.referral_commission_rates is
  'Partner hak edis orani, plan basina. Oran revizyonunda BURASI degisir, kod degil. Ucretsiz plan satiri YOK: komisyon dogurmaz.';

insert into public.referral_commission_rates (plan, oran, aciklama) values
  ('student',      0.1000, 'Ogrenci — buyume kurgusunun merkezi; tesvik icin yukseltilebilir'),
  ('professional', 0.1000, 'Profesyonel'),
  ('stk',          0.1000, 'STK Ozel'),
  ('business',     0.1000, 'Kurumsal'),
  ('corporate',    0.1000, 'Pazarlikla satilan kademe; plan_prices satiri yok, taban odenen tutar olur')
on conflict (plan) do update
  set oran = excluded.oran, aciklama = excluded.aciklama, updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Mükerrer ödeme engeli
-- ---------------------------------------------------------------------------
-- Hak ediş artık her ödemede doğduğu için satırın bir çapaya bağlanması
-- gerekiyor: hangi ödeme için yazıldı. commissions'ta tekil kısıt yoktu,
-- tetikleyici iki kez çalışsa iki kez öderdi.
alter table public.commissions
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null;

create unique index if not exists commissions_odeme_tekil_idx
  on public.commissions (payment_intent_id)
  where payment_intent_id is not null;

comment on column public.commissions.payment_intent_id is
  'Hangi odeme icin yazildi. Tekil: ayni odeme iki kez hak edis dogurmaz.';

-- ---------------------------------------------------------------------------
-- 3) Tetikleyici fonksiyonu
-- ---------------------------------------------------------------------------
-- OLD'a hiç bakmaz: böylece INSERT'te de çalışabilir.
create or replace function public.update_referral_on_subscription()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $fn$
declare
  v_niyet      public.payment_intents;
  v_oran       numeric(5,4);
  v_taban      bigint;
  v_komisyon   numeric(10,2);
  v_davet_id   uuid;
  v_getiren    uuid;
  v_plan_adi   text;
begin
  -- Ücretsiz ya da askıdaki abonelik hak ediş doğurmaz.
  if new.status is distinct from 'active' or new.plan is null or new.plan = 'free' then
    return new;
  end if;

  -- DOĞRULANMIŞ ÖDEME ŞARTI. payment_settle niyeti granted_at = now() ile
  -- işaretleyip ardından aboneliği aynı işlemde güncelliyor; now() işlem
  -- boyunca sabit olduğu için eşitlik yalnız gerçek ödemede sağlanır.
  -- Yönetici elle plan verdiğinde böyle bir niyet olmaz → komisyon yazılmaz.
  select * into v_niyet
    from public.payment_intents pi
   where pi.profile_id = new.profile_id
     and pi.granted_at = now()
   order by pi.amount_kurus desc
   limit 1;

  if v_niyet.id is null then
    return new;
  end if;

  select r.oran into v_oran
    from public.referral_commission_rates r
   where r.plan = new.plan;

  if v_oran is null or v_oran = 0 then
    perform public.log_event('referral.commission_skipped', null, 'qrtim', 'subscription',
      new.profile_id::text, 'denied', 'notice', 'internal',
      jsonb_build_object('sebep', 'oran_tanimsiz', 'plan', new.plan), 'system');
    return new;
  end if;

  -- Davet kaydı: durumuna bakılmaz, yenilemede de ödenecek.
  select rf.id, rf.referrer_id into v_davet_id, v_getiren
    from public.referrals rf
   where rf.referee_id = new.profile_id
   order by rf.created_at asc
   limit 1;

  if v_davet_id is null or v_getiren is null then
    return new;
  end if;

  -- Taban: kartsız fiyat; yoksa ödenen tutar. Ödenenin üstüne çıkamaz.
  select pp.amount_kurus into v_taban
    from public.plan_prices pp
   where pp.plan = v_niyet.plan
     and pp.period = v_niyet.period
     and pp.with_nfc = false
   limit 1;

  v_taban := least(coalesce(v_taban, v_niyet.amount_kurus), v_niyet.amount_kurus);
  v_komisyon := round((v_taban * v_oran) / 100.0, 2);

  if v_komisyon <= 0 then
    return new;
  end if;

  v_plan_adi := case new.plan
    when 'student' then 'Öğrenci Plan'
    when 'professional' then 'Profesyonel Plan'
    when 'stk' then 'STK Özel Plan'
    when 'business' then 'Kurumsal Plan'
    else initcap(new.plan) || ' Plan'
  end;

  -- Mükerrer engeli: aynı ödeme ikinci kez hak ediş doğurmaz.
  insert into public.commissions
    (profile_id, referral_id, payment_intent_id, amount, type, status, description)
  values
    (v_getiren, v_davet_id, v_niyet.id, v_komisyon, 'referral', 'approved',
     v_plan_adi || ' — %' || trim(to_char(v_oran * 100, 'FM999D99')) || ' partner hak edişi')
  on conflict (payment_intent_id) where payment_intent_id is not null do nothing;

  if not found then
    return new;
  end if;

  -- Davet kaydında BİRİKİMLİ toplam: panel "bu davetten ne kazandım"ı görsün.
  update public.referrals
     set status = 'active',
         commission_amount = coalesce(commission_amount, 0) + v_komisyon,
         completed_at = coalesce(completed_at, now())
   where id = v_davet_id;

  update public.referral_codes
     set total_earnings = coalesce(total_earnings, 0) + v_komisyon
   where profile_id = v_getiren;

  perform public.log_event('referral.commission_created', null, 'qrtim', 'commission',
    v_davet_id::text, 'success', 'critical', 'internal',
    jsonb_build_object('tutar', v_komisyon, 'oran', v_oran, 'plan', new.plan,
                       'taban_kurus', v_taban, 'odeme_niyeti', v_niyet.id), 'system');

  return new;
end;
$fn$;

comment on function public.update_referral_on_subscription() is
  'Partner hak edisi: referral_commission_rates oranindan, kartsiz fiyat tabanindan. Her dogrulanmis odemede (yenileme dahil) bir kez.';

-- ---------------------------------------------------------------------------
-- 4) Tetikleyici: INSERT de kapsanıyor
-- ---------------------------------------------------------------------------
drop trigger if exists on_subscription_upgrade on public.subscriptions;
create trigger on_subscription_upgrade
  after insert or update on public.subscriptions
  for each row execute function public.update_referral_on_subscription();
