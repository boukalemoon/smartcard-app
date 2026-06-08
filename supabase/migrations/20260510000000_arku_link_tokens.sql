-- Partner (Arku Remote, İlgezdi vb.) SSO bağlantısı için tek kullanımlık,
-- kısa ömürlü token'lar.
--
-- Akış: Partner uygulama kullanıcıyı qartim.com/login?callback=...&source=<partner>
-- adresine yönlendirir. Kullanıcı giriş yapınca `partner-issue-token` edge
-- function'ı (kullanıcının oturumu ile) bir token üretip bu tabloya yazar ve
-- partner'a geri yönlendirir. Partner, token'ı `arku-link` (veya kendi)
-- doğrulama function'ına gönderip kullanıcının QRtım kimliğini okur.
-- Token tek kullanımlıktır ve 5 dakika içinde geçerliliğini yitirir.

create table if not exists public.partner_link_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  partner     text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create index if not exists partner_link_tokens_user_id_idx
  on public.partner_link_tokens (user_id);

alter table public.partner_link_tokens enable row level security;

-- İstemciye hiçbir doğrudan erişim verilmez. Token üretimi ve doğrulaması
-- yalnızca service_role ile çalışan edge function'lar üzerinden yapılır.
-- (RLS açık + politika yok => anon/authenticated erişemez.)
