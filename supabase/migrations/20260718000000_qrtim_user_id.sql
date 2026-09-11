-- QRtım Kullanıcı Kimliği — her kullanıcıya QRtım'a özel, dahili, kalıcı ID.
--
-- • Kullanıcı bunu SADECE kendi profilinde BİLGİ olarak görür (kopyalanamaz/
--   paylaşılamaz — UI tarafında). Başka kullanıcılar göremez (Facebook ID mantığı).
-- • Diğer uygulamalarla (Tınga/İlgezdi/Arku) entegrasyon doğrulaması ve Ana Ülgen
--   tarafında kullanıcının tanınması bu ID ile yapılır.
--
-- NEDEN AYRI TABLO (profiles'a KOLON EKLEMİYORUZ):
--   PublicCard anon client ile `profiles.select('*')` yapıyor → profiles satırı
--   herkese açık okunabiliyor. Kimlik ID'sini profiles'a koysak herkes başkasının
--   ID'sini kartından okurdu. Bu yüzden anon erişimi OLMAYAN ayrı tabloda tutulur
--   (eski ulgen_* anon-all açığı tekrar etmesin — bkz. 20260713000100).

create extension if not exists pgcrypto;

create table if not exists public.qrtim_user_ids (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  qrtim_uid   uuid unique not null default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

create index if not exists qrtim_user_ids_qrtim_uid_idx
  on public.qrtim_user_ids (qrtim_uid);

alter table public.qrtim_user_ids enable row level security;

-- Kullanıcı YALNIZ kendi kimliğini OKUR (bilgi). Yazma/silme YOK (sistem üretir).
-- anon erişimi YOK. Ana Ülgen backend'i service_role ile (RLS bypass) okur.
drop policy if exists "qrtim_user_ids_self_read" on public.qrtim_user_ids;
create policy "qrtim_user_ids_self_read"
  on public.qrtim_user_ids for select
  to authenticated
  using (user_id = auth.uid());

-- Mevcut kullanıcılar için kimlik üret
insert into public.qrtim_user_ids (user_id)
  select distinct user_id from public.profiles
  where user_id is not null
  on conflict (user_id) do nothing;

-- Yeni profil oluşunca otomatik kimlik üret
-- security definer + search_path sabit (sertleştirme) + RPC erişimi kapalı
create or replace function public.ensure_qrtim_user_id()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.user_id is not null then
    insert into public.qrtim_user_ids (user_id)
      values (new.user_id)
      on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.ensure_qrtim_user_id() from public, anon, authenticated;

drop trigger if exists trg_ensure_qrtim_user_id on public.profiles;
create trigger trg_ensure_qrtim_user_id
  after insert on public.profiles
  for each row execute function public.ensure_qrtim_user_id();

comment on table public.qrtim_user_ids is
  'QRtım kullanıcı kimliği. Kullanıcı kendi profilinde bilgi olarak görür (kopyalanamaz). Ana Ülgen bu ID ile (service_role) kullanıcıyı tanır/veri çeker. anon erişimi yoktur.';
