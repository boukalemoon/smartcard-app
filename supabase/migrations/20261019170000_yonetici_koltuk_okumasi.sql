-- ============================================================================
-- Platform yöneticisi koltukları okur
-- ============================================================================
--
-- org_seats'te iki okuma politikası vardı: üye kendi koltuğunu, kurum
-- yöneticisi kurumunun koltuklarını. Platform yöneticisi için politika YOKTU,
-- yani yönetici panelinde "kaç koltuk dağıtılmış" sorusu cevaplanamıyordu.
-- Kotayı o giriyor; kullanımı görmeden kota ayarlamak körlemesine olurdu.
--
-- Not: is_admin() ShieldAuth devreye girince TOTP kurmuş yöneticide taze
-- doğrulama istiyor. Bu politika da ondan geçiyor, ayrı bir yol açılmıyor.

drop policy if exists "yonetici tum koltuklari gorur" on public.org_seats;
create policy "yonetici tum koltuklari gorur"
  on public.org_seats for select to authenticated
  using (public.is_admin());
