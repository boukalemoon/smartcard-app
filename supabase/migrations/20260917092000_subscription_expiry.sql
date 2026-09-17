-- ============================================================================
-- SÜRESİ DOLAN ABONELİK → ÜCRETSİZ
-- ============================================================================
--
-- SORUN: expires_at geçmiş ücretli abonelikleri düşüren hiçbir işlem yoktu.
-- Bir kez ödeme yapan (ya da elle plan verilen) hesap sonsuza dek ücretli
-- planda kalıyordu.
--
-- KARARLAR:
--   • Plan 'free' olur, satır silinmez; kullanıcının geçmişi denetim kaydında.
--   • expires_at NULL olan ücretli abonelik süresizdir (yalnızca yönetici
--     verebilir) ve düşürülmez.
--   • NFC: daha önce kullanılmış kart hakkı geri alınmaz (kart kişinin
--     elinde), yalnızca kullanılmamış hak sıfırlanır.
--   • Kullanıcıya bildirim kuyruğa yazılır.
--   • Komisyon tetikleyicisi etkilenmez (yalnızca ücretsizden ücretliye
--     geçişte çalışır).

create or replace function public.expire_subscriptions()
returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  r   record;
  v_n int := 0;
begin
  for r in
    select s.id, s.profile_id, s.plan, s.billing_cycle, s.expires_at,
           coalesce(s.nfc_cards_included, 0) as nfc_hak,
           coalesce(s.nfc_cards_used, 0)     as nfc_kullanilan,
           p.user_id
      from public.subscriptions s
      left join public.profiles p on p.id = s.profile_id
     where s.plan <> 'free'
       and s.expires_at is not null
       and s.expires_at < now()
     for update of s skip locked
  loop
    update public.subscriptions
       set plan = 'free',
           billing_cycle = 'monthly',
           status = 'active',
           expires_at = null,
           organizations_limit = 2,
           social_links_limit = 3,
           nfc_cards_included = least(r.nfc_hak, r.nfc_kullanilan),
           updated_at = now()
     where id = r.id;

    perform public.log_event('subscription.expired', null, 'qrtim', 'subscription', r.id::text,
                             'success', 'notice', 'user',
                             jsonb_build_object('eski_plan', r.plan,
                                                'eski_donem', r.billing_cycle,
                                                'bitis', r.expires_at),
                             'system', null, null, null, r.user_id);

    if r.user_id is not null then
      insert into public.notification_outbox (user_id, channel, template, payload)
      values (r.user_id, 'email', 'abonelik_suresi_doldu',
              jsonb_build_object('eski_plan', r.plan, 'bitis', r.expires_at)),
             (r.user_id, 'inapp', 'abonelik_suresi_doldu',
              jsonb_build_object('eski_plan', r.plan));
    end if;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$fn$;

revoke all on function public.expire_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_subscriptions() to service_role;

-- ---------------------------------------------------------------------------
-- Kullanıcı talebi (17.09.2026): burakakmese Profesyonel planda kalacak.
-- Önceden: business, süresiz, 999 NFC. Yalnızca plan değişiyor.
-- ---------------------------------------------------------------------------

do $mig$
declare v_prof uuid; v_eski text;
begin
  select p.id into v_prof from public.profiles p where p.email = 'burakakmese@gmail.com';
  if v_prof is null then return; end if;

  select s.plan into v_eski from public.subscriptions s where s.profile_id = v_prof;
  if v_eski is distinct from 'business' then return; end if;

  update public.subscriptions
     set plan = 'professional', updated_at = now()
   where profile_id = v_prof;

  perform public.log_event('admin.set_plan', null, 'qrtim', 'subscription', v_prof::text,
                           'success', 'critical', 'user',
                           jsonb_build_object('eski_plan', v_eski, 'yeni_plan', 'professional',
                                              'gerekce', 'Kullanici talebi (17.09.2026)'),
                           'system', null, null, null,
                           (select p.user_id from public.profiles p where p.id = v_prof));
end
$mig$;

select public.expire_subscriptions();
