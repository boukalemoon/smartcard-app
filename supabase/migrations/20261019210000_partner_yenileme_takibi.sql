-- ============================================================================
-- Partner yenileme takibi
-- ============================================================================
--
-- my_referrals davet başına TEK satır ve BİRİKİMLİ tutar döndürüyor. Hak ediş
-- artık her ödemede doğduğu için (20261018090000) partnerin görmesi gereken
-- şey başka: getirdiği müşteri aboneliğini SÜRDÜRÜYOR MU, bir sonraki
-- yenileme ne zaman, hangi ödemeden ne kazandım.
--
-- GÖSTERİLMEYENLER, bilerek:
--   • Müşterinin e-postası, telefonu, kart adresi — partnerin işi değil.
--   • Müşterinin ÖDEDİĞİ tutar. Partner yalnız KENDİ hak edişini görüyor.
--     (Oran %10 ve fiyat listesi herkese açık olduğu için kademe zaten
--     tahmin edilebilir; ödenen tutarı ayrıca vermenin faydası yok.)
--   • Silinmiş hesapta ad yerine "QRtım kullanıcısı" yazılır — my_referrals
--     ile aynı davranış.
--
-- Abonelik durumu ve yenileme tarihi GÖSTERİLİR: partnerin geliri doğrudan
-- buna bağlı, bu bilgi olmadan "takip" diye bir şey olmaz.
--
-- JSON anahtarları ASCII: Türkçe karakterli anahtar SQL ile JS arasında
-- kodlama sorununa davetiye.

create or replace function public.my_referral_tracking()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ben   uuid := public.my_profile_id();
  v_liste jsonb;
  v_ozet  jsonb;
begin
  if auth.uid() is null or v_ben is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  -- Sürenler üstte, sonra en çok kazandıran.
  select coalesce(jsonb_agg(x order by sira, toplam desc), '[]'::jsonb)
    into v_liste
  from (
    select
      jsonb_build_object(
        'davet_id', r.id,
        'ad', case when r.referee_id is null then 'QRtım kullanıcısı'
                   else coalesce(nullif(p.name, ''), 'QRtım kullanıcısı') end,
        'hesap_silinmis', r.referee_id is null,
        'davet_tarihi', r.created_at,
        'plan', s.plan,
        -- Süresi geçmiş abonelik "sürmüyor" sayılır (my_plan_limits ile aynı tanım).
        'suruyor', coalesce(s.status = 'active' and (s.expires_at is null or s.expires_at > now()), false),
        'yenileme', s.expires_at,
        'toplam_hakedis', coalesce(k.toplam, 0),
        'odeme_sayisi', coalesce(k.adet, 0),
        'odemeler', coalesce(k.satirlar, '[]'::jsonb)
      ) as x,
      case when coalesce(s.status = 'active' and (s.expires_at is null or s.expires_at > now()), false)
           then 0 else 1 end as sira,
      coalesce(k.toplam, 0) as toplam
    from public.referrals r
    left join public.profiles p on p.id = r.referee_id
    left join public.subscriptions s on s.profile_id = r.referee_id
    left join lateral (
      select count(*) as adet,
             sum(c.amount) as toplam,
             jsonb_agg(jsonb_build_object(
               'tarih', c.created_at,
               'tutar', c.amount,
               'durum', c.status,
               'odendi', c.paid_at
             ) order by c.created_at desc) as satirlar
        from public.commissions c
       where c.referral_id = r.id and c.profile_id = v_ben and c.type = 'referral'
    ) k on true
   where r.referrer_id = v_ben
  ) y;

  select jsonb_build_object(
           'davet', count(*),
           'suren_abonelik', count(*) filter (where (x ->> 'suruyor')::boolean),
           'toplam_hakedis', coalesce(sum((x ->> 'toplam_hakedis')::numeric), 0),
           -- 30 gün içinde yenilemesi gelenler: partner takip edebilsin.
           'yakinda_yenilenen', count(*) filter (
             where (x ->> 'yenileme') is not null
               and (x ->> 'yenileme')::timestamptz > now()
               and (x ->> 'yenileme')::timestamptz < now() + interval '30 days')
         )
    into v_ozet
    from jsonb_array_elements(v_liste) x;

  return jsonb_build_object(
    'ok', true,
    'ozet', coalesce(v_ozet, jsonb_build_object('davet', 0, 'suren_abonelik', 0,
                                                'toplam_hakedis', 0, 'yakinda_yenilenen', 0)),
    'davetler', v_liste);
end;
$$;

revoke all on function public.my_referral_tracking() from public, anon;
grant execute on function public.my_referral_tracking() to authenticated;

comment on function public.my_referral_tracking() is
  'Partnerin getirdigi musterilerin abonelik durumu, yenileme tarihi ve odeme basina hak edisi. Musterinin e-postasi ve odedigi tutar GOSTERILMEZ.';
