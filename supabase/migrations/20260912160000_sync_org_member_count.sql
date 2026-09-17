-- ============================================================================
-- ADIM 4 — ÜYE SAYACI GERÇEK SAYIYA BAĞLANDI
-- ============================================================================
--
-- organizations.member_count TÜM kurumlarda 0 görünüyordu, oysa 9 üyelik
-- kaydı vardı. Denormalize sayaç hiç güncellenmiyordu. Toplu indirim mantığı
-- ("10+ üyede %20 indirim") bu alana bakıyorsa hiç tetiklenmezdi.
--
-- Doğrulandı (geri alınan işlemde, AYRI ifadelerle): 1 -> 2 -> 1.
-- Not: aynı komut içinde ölçüldüğünde sayaç değişmemiş görünür — Postgres'te
-- bir komut kendi yazdıklarını görmez. İlk test bu yüzden yanıltmıştı.

create or replace function public.sync_org_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  v_org := coalesce(new.organization_id, old.organization_id);
  if v_org is not null then
    update public.organizations o
    set member_count = (select count(*) from public.members m where m.organization_id = v_org)
    where o.id = v_org;
  end if;

  -- UPDATE ile üye başka kuruma taşındıysa eski kurumu da güncelle
  if tg_op = 'UPDATE'
     and old.organization_id is distinct from new.organization_id
     and old.organization_id is not null then
    update public.organizations o
    set member_count = (select count(*) from public.members m where m.organization_id = old.organization_id)
    where o.id = old.organization_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_org_member_count on public.members;
create trigger trg_sync_org_member_count
  after insert or update or delete on public.members
  for each row execute function public.sync_org_member_count();

update public.organizations
set member_count = (select count(*) from public.members m where m.organization_id = organizations.id);
