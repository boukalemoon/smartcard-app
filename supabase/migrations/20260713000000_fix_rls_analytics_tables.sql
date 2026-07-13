-- Güvenlik düzeltmesi: analytics tablolarında RLS.
--
-- analytics_events: doğru politikalar (anon INSERT + sahibi SELECT) tanımlıydı
-- ancak RLS enable edilmemişti; bu yüzden politikalar çalışmıyor, tüm kayıtlar
-- (IP adresi, user-agent dahil) anon anahtarıyla okunabiliyordu.
alter table public.analytics_events enable row level security;

-- analytics_sessions: RLS tamamen kapalıydı (tam açık). Sahiplik kolonu yok.
-- İzleme (INSERT/UPDATE) anon ile devam etsin; toplu okuma engellensin.
-- SELECT politikası yok => yalnızca service_role okuyabilir.
alter table public.analytics_sessions enable row level security;

create policy "anon can insert sessions"
  on public.analytics_sessions for insert to anon with check (true);

create policy "anon can update own session heartbeat"
  on public.analytics_sessions for update to anon using (true) with check (true);
