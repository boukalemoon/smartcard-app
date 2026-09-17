-- Kurtarma kişisi, kendisinden onay bekleyen talepleri uygulama içinde de
-- görebilmeli. Testte ortaya çıktı: recovery_requests okuma politikası
-- yalnızca sahibine açık (doğru), bu yüzden kurtarma kişisi talep kimliğini
-- ancak e-postadan alabiliyordu.
--
-- Yalnızca GEREKLİ ALANLAR dönüyor: kurtarma kişisinin talebin IP'sini,
-- cihazını veya iptal belirtecini görmesi için hiçbir sebep yok.

create or replace function public.recovery_pending_for_me()
returns table (
  request_id   uuid,
  talep_eden   text,
  yontem       text,
  acildi       timestamptz,
  acilabilir   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select r.id,
         coalesce(nullif(p.name, ''), split_part(u.email, '@', 1)),
         r.method, r.opened_at, r.unlock_at
    from public.recovery_requests r
    join public.recovery_contacts c
      on c.user_id = r.user_id
     and c.contact_user_id = auth.uid()
     and c.status = 'active'
    left join auth.users u on u.id = r.user_id
    left join public.profiles p on p.user_id = r.user_id
   where auth.uid() is not null
     and r.status in ('beklemede','dogrulandi','bekleme_suresinde')
   order by r.opened_at desc
   limit 50;
$fn$;

revoke all on function public.recovery_pending_for_me() from public, anon;
grant execute on function public.recovery_pending_for_me() to authenticated;
