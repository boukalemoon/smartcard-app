-- ============================================================================
-- ZAMANLANMIŞ İŞLER (pg_cron)
-- ============================================================================
--
-- Şimdiye kadar süresi dolan abonelik, kurtarma talebi, oturum temizliği ve
-- denetim kaydı saklama süresi yalnızca "birisi çağırırsa" çalışıyordu.
-- Hiçbiri çağrılmıyordu: pg_cron kurulu değildi.

create extension if not exists pg_cron;

do $mig$
declare j text;
begin
  foreach j in array array['qrtim-abonelik-suresi','qrtim-kurtarma-suresi',
                           'qrtim-oturum-temizligi','qrtim-denetim-saklama']
  loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end
$mig$;

-- Saatte bir: bir günlük gecikme, süresi dolmuş hesabın ücretli özellikleri
-- kullanmaya devam etmesi demek.
select cron.schedule('qrtim-abonelik-suresi',  '7 * * * *',  $$select public.expire_subscriptions()$$);
select cron.schedule('qrtim-kurtarma-suresi',  '17 * * * *', $$select public.recovery_expire_stale()$$);
-- Günde bir, trafiğin en düşük olduğu saatte (03:27 UTC = 06:27 TR)
select cron.schedule('qrtim-oturum-temizligi', '27 3 * * *', $$select public.cleanup_expired_sessions()$$);
-- Haftada bir: denetim kaydı imhası.
-- (Sabit gün sayısı 20260917130000 ile kaldırıldı; komut artık prune_audit_log().)
select cron.schedule('qrtim-denetim-saklama',  '37 3 * * 0', $$select public.prune_audit_log(400)$$);
