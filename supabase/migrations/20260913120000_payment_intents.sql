-- ============================================================================
-- ÖDEME ALTYAPISI — PayNkolay (Aktifbank) için arka uç
-- ============================================================================
--
-- BUGÜNKÜ DURUM: PaymentModal.jsx içinde `const paymentSuccess = true`.
-- Yani ödeme HİÇ ALINMADAN NFC hakkı tanımlanıyor.
--
-- İKİNCİ VE DAHA SESSİZ SORUN: fiyatlar istemcide tanımlı. Tarayıcıda
-- değiştirilebilir. Tutarı ASLA istemciden almayacağız.
--
-- TEMEL KURALLAR:
--   • Tutar sunucuda hesaplanır (plan_prices).
--   • Para KURUŞ cinsinden tamsayıdır. Ondalık sayı parada kullanılmaz.
--   • Ödemenin gerçekleştiğine yalnızca BANKANIN imzalı bildirimi karar verir;
--     tarayıcının döndüğü sayfa değil.
--   • Bildirim iki kez gelebilir: hak tanımlama idempotent olmalı.
--   • Merchant sırrı yalnızca Edge Function ortamında durur.
--
-- NOT: Bu dosyadaki payment_settle, 20260913130000_lock_billing_writes.sql
-- içinde TUTAR DOĞRULAMALI sürümüyle değiştirildi.

create table if not exists public.plan_prices (
  plan         text not null,
  period       text not null,
  with_nfc     boolean not null default false,
  amount_kurus bigint not null,
  nfc_included int not null default 0,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (plan, period, with_nfc),
  constraint plan_prices_period_chk check (period in ('monthly','yearly')),
  constraint plan_prices_amount_chk check (amount_kurus > 0)
);

comment on table public.plan_prices is
  'Fiyatların TEK kaynağı. İstemcideki fiyat yalnızca gösterim içindir.';

insert into public.plan_prices (plan, period, with_nfc, amount_kurus, nfc_included) values
  ('student','monthly',false,   9900, 0),
  ('student','yearly', false,  99000, 1),
  ('student','yearly', true,  178900, 1),
  ('professional','monthly',false,  24900, 0),
  ('professional','yearly', false, 249000, 1),
  ('professional','yearly', true,  328900, 1),
  ('stk','monthly',false,  44900, 0),
  ('stk','yearly', false, 429000, 6),
  ('stk','yearly', true,  508900, 6),
  ('business','monthly',false,  89900, 0),
  ('business','yearly', false, 899000, 10),
  ('business','yearly', true,  978900, 10)
on conflict (plan, period, with_nfc) do nothing;

alter table public.plan_prices enable row level security;
drop policy if exists "fiyatlar okunabilir" on public.plan_prices;
create policy "fiyatlar okunabilir"
  on public.plan_prices for select to anon, authenticated
  using (is_active);

create table if not exists public.payment_intents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  profile_id     uuid references public.profiles(id) on delete set null,
  plan           text not null,
  period         text not null,
  with_nfc       boolean not null default false,
  amount_kurus   bigint not null,
  currency       text not null default 'TRY',
  status         text not null default 'olusturuldu',
  provider       text not null default 'paynkolay',
  provider_ref   text,
  merchant_ref   text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at     timestamptz not null default now(),
  redirected_at  timestamptz,
  settled_at     timestamptz,
  failed_reason  text,
  callback_raw   jsonb,
  granted_at     timestamptz,
  constraint payment_intents_status_chk check (status in
    ('olusturuldu','yonlendirildi','odendi','basarisiz','iptal','iade')),
  constraint payment_intents_amount_chk check (amount_kurus > 0)
);

comment on column public.payment_intents.merchant_ref is
  'Bankaya gönderdiğimiz kendi referansımız. Bildirim bununla eşleştirilir.';
comment on column public.payment_intents.granted_at is
  'Hakkın tanımlandığı an. Dolu ise ikinci bildirim tekrar hak tanımlamaz.';

create unique index if not exists payment_intents_merchant_ref_idx
  on public.payment_intents (merchant_ref);
create index if not exists payment_intents_user_idx
  on public.payment_intents (user_id, created_at desc);

alter table public.payment_intents enable row level security;

drop policy if exists "kendi odemelerini gorur" on public.payment_intents;
create policy "kendi odemelerini gorur"
  on public.payment_intents for select to authenticated
  using (user_id = (select auth.uid()));
-- Yazma politikası YOK: niyet yalnızca RPC ile açılır, sonucu yalnızca
-- service_role (banka bildirimi) yazar. İstemci kendi ödemesini
-- "ödendi" işaretleyemez (test edildi: etkilenen satır 0).

create or replace function public.payment_create_intent(
  p_plan     text,
  p_period   text,
  p_with_nfc boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_prof uuid;
  v_fiyat public.plan_prices;
  v_id uuid;
  v_ref text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  select * into v_fiyat from public.plan_prices pp
   where pp.plan = p_plan and pp.period = p_period
     and pp.with_nfc = coalesce(p_with_nfc,false) and pp.is_active;

  if v_fiyat.plan is null then
    return jsonb_build_object('ok', false, 'hata', 'plan_bulunamadi');
  end if;

  select p.id into v_prof from public.profiles p where p.user_id = v_user;

  -- Aynı kullanıcının bekleyen niyetlerini iptal et: her denemede yeni
  -- referans üretilir, eskisi bankada asılı kalmasın.
  update public.payment_intents
     set status = 'iptal', failed_reason = 'yeni_niyet_acildi'
   where user_id = v_user and status in ('olusturuldu','yonlendirildi');

  insert into public.payment_intents
    (user_id, profile_id, plan, period, with_nfc, amount_kurus)
  values
    (v_user, v_prof, p_plan, p_period, coalesce(p_with_nfc,false), v_fiyat.amount_kurus)
  returning id, merchant_ref into v_id, v_ref;

  perform public.log_event('payment.intent_created', v_user, 'qrtim',
                           'payment_intent', v_id::text,
                           'success', 'notice', 'user',
                           jsonb_build_object('plan', p_plan, 'period', p_period,
                                              'nfc', coalesce(p_with_nfc,false),
                                              'tutar_kurus', v_fiyat.amount_kurus));

  return jsonb_build_object('ok', true, 'intent_id', v_id, 'merchant_ref', v_ref,
                            'tutar_kurus', v_fiyat.amount_kurus,
                            'tutar_tl', round(v_fiyat.amount_kurus / 100.0, 2));
end;
$fn$;

-- İlk sürüm; 20260913130000'da tutar doğrulamalı sürümle değiştirildi.
create or replace function public.payment_settle(
  p_merchant_ref text,
  p_success      boolean,
  p_provider_ref text default null,
  p_raw          jsonb default '{}'::jsonb,
  p_reason       text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_i public.payment_intents; v_bitis timestamptz;
begin
  select * into v_i from public.payment_intents pi where pi.merchant_ref = p_merchant_ref;
  if v_i.id is null then
    return jsonb_build_object('ok', false, 'hata', 'niyet_bulunamadi');
  end if;

  if v_i.granted_at is not null then
    update public.payment_intents
       set callback_raw = coalesce(callback_raw,'{}'::jsonb) || jsonb_build_object('tekrar', p_raw)
     where id = v_i.id;
    return jsonb_build_object('ok', true, 'zaten_islendi', true);
  end if;

  if not p_success then
    update public.payment_intents
       set status = 'basarisiz', failed_reason = p_reason,
           provider_ref = coalesce(p_provider_ref, provider_ref),
           callback_raw = p_raw, settled_at = now()
     where id = v_i.id;

    perform public.log_event('payment.failed', v_i.user_id, 'qrtim',
                             'payment_intent', v_i.id::text,
                             'failure', 'warning', 'user',
                             jsonb_build_object('sebep', p_reason), 'service',
                             null, null, null, v_i.user_id);
    return jsonb_build_object('ok', true, 'sonuc', 'basarisiz');
  end if;

  v_bitis := case when v_i.period = 'yearly'
                  then now() + interval '1 year' else now() + interval '1 month' end;

  update public.payment_intents
     set status = 'odendi', settled_at = now(), granted_at = now(),
         provider_ref = coalesce(p_provider_ref, provider_ref), callback_raw = p_raw
   where id = v_i.id;

  update public.subscriptions s
     set plan = v_i.plan,
         billing_cycle = v_i.period,
         status = 'active',
         started_at = now(),
         expires_at = v_bitis,
         nfc_cards_included = greatest(
           coalesce(s.nfc_cards_included,0),
           coalesce((select pp.nfc_included from public.plan_prices pp
                      where pp.plan = v_i.plan and pp.period = v_i.period
                        and pp.with_nfc = v_i.with_nfc), 0)),
         updated_at = now()
   where s.profile_id = v_i.profile_id;

  perform public.log_event('payment.settled', v_i.user_id, 'qrtim',
                           'payment_intent', v_i.id::text,
                           'success', 'critical', 'user',
                           jsonb_build_object('plan', v_i.plan, 'period', v_i.period,
                                              'tutar_kurus', v_i.amount_kurus,
                                              'gecerlilik', v_bitis),
                           'service', null, null, null, v_i.user_id);

  return jsonb_build_object('ok', true, 'sonuc', 'odendi', 'gecerlilik', v_bitis);
end;
$fn$;

create or replace function public.payment_status(p_intent_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $fn$
  select jsonb_build_object('durum', pi.status, 'tutar_kurus', pi.amount_kurus,
                            'plan', pi.plan, 'period', pi.period,
                            'odendi_mi', pi.granted_at is not null)
    from public.payment_intents pi
   where pi.id = p_intent_id and pi.user_id = auth.uid();
$fn$;

revoke all on function public.payment_create_intent(text,text,boolean) from public, anon;
grant execute on function public.payment_create_intent(text,text,boolean) to authenticated;
revoke all on function public.payment_status(uuid) from public, anon;
grant execute on function public.payment_status(uuid) to authenticated;
revoke all on function public.payment_settle(text,boolean,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.payment_settle(text,boolean,text,jsonb,text) to service_role;

drop trigger if exists audit_payment_intents_trg on public.payment_intents;
create trigger audit_payment_intents_trg
  after insert or update or delete on public.payment_intents
  for each row execute function public.audit_row_change('user_id', 'auth');
