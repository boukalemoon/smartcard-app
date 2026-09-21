-- ============================================================================
-- HAKEDİŞ HESABI — doğruluk düzeltmeleri
-- ============================================================================
--
-- DURUM: hakediş sistemi bugüne kadar HİÇ doğru sayı üretmedi. Kayıtlı iki
-- satır Şubat 2026'dan, ikisi de 0 üye / ₺0 — oysa o kurumların üyesi vardı.
-- Zamanlanmış görevde de değildi. Aşağıdaki hataların hepsi fiyat modelinden
-- BAĞIMSIZ: oran ne olursa olsun bu sayımlar yanlıştı.
--
-- 1) ORAN KODA GÖMÜLÜYDÜ (STK ₺5, kurumsal ₺10). Fiyat revizyonunda kod
--    değiştirmek gerekecekti. Tabloya taşındı; DEĞERLER AYNI bırakıldı, bu
--    göç davranışı değiştirmiyor.
--
-- 2) SABİT TÜR LİSTESİ. Fonksiyon 'association','foundation','community',
--    'union','company','corporation' diye sayıyordu. Veritabanında 'dernek'
--    (Türkçe) yazan bir kurum var; o kurum hakediş hesabının tamamen DIŞINDA
--    kalıyordu ve hata da vermiyordu. Artık tür listesi tabloda.
--
-- 3) KABUL EDİLMEMİŞ DAVET ÜYE SAYILIYORDU. Davet akışından sonra
--    status='active' ama accepted_at boş satırlar oluşabiliyor. Bunları
--    saymak, katılmamış kişi için para hesaplamak demek.
--
-- 4) HANGİ YÖNETİCİYE YAZILACAĞI RASTGELEYDİ. Döngü kurumun HER yöneticisi
--    için dönüyor, tekillik kısıtı yüzünden yalnızca ilki yazılıyordu —
--    hangisi olduğu sorgu planına kalmıştı. Artık kurumu KURAN kişi
--    (organizations.created_by), o yoksa en eski kabul edilmiş yönetici.
--    Sahibi çözülemeyen kuruma kayıt YAZILMAZ: parayı kime yazdığımızı
--    bilmiyorsak kayıt oluşturmak, sonradan yanlış kişiye ödeme demektir.
--
-- 5) İÇİNDE BULUNULAN AY hesaplanıyordu; ay bitmeden üye sayısı kesin
--    değildir. Artık varsayılan TAMAMLANMIŞ ay, istenirse dönem verilebilir.
--
-- 6) ÖDENMİŞ DÖNEM YENİDEN YAZILMIYOR. Yeniden çalıştırma yalnızca 'pending'
--    satırları günceller; birine ödenmiş bir tutarı sessizce değiştirmek
--    muhasebeyi bozar.
--
-- NOT (fiyat revizyonunda ele alınacak): bu tablo parayı numeric(10,2) TL
-- olarak tutuyor, plan_prices ise kuruş (integer). İki gösterim bir arada
-- ₺5 / 500 karışıklığına açık kapı; revizyonda tek gösterime çekilmeli.

create table if not exists public.commission_rates (
  org_type   text primary key,
  uye_basi   numeric(10,2) not null check (uye_basi >= 0),
  aciklama   text,
  updated_at timestamptz not null default now()
);

alter table public.commission_rates enable row level security;

drop policy if exists "yonetici oranlari gorur" on public.commission_rates;
create policy "yonetici oranlari gorur" on public.commission_rates
  for select to authenticated using (public.is_admin());

revoke all on public.commission_rates from anon;
revoke insert, update, delete on public.commission_rates from authenticated;

comment on table public.commission_rates is
  'Kurum turune gore aylik uye basi hakedis. Fiyat revizyonunda BURASI degisir, kod degil.';

insert into public.commission_rates (org_type, uye_basi, aciklama) values
  ('association', 5.00,  'STK - dernek'),
  ('dernek',      5.00,  'STK - dernek (Turkce tur adi, veri temizligine kadar)'),
  ('foundation',  5.00,  'STK - vakif'),
  ('community',   5.00,  'STK - topluluk'),
  ('union',       5.00,  'STK - sendika'),
  ('company',    10.00,  'Kurumsal - sirket'),
  ('corporation',10.00,  'Kurumsal - holding')
on conflict (org_type) do nothing;

-- Eski, parametresiz sürüm duruyordu. Yeni sürüm iki parametreyi de
-- varsayılanlı aldığı için parametresiz çağrı İKİ adaya da uyuyor ve
-- PostgreSQL "function is not unique" diyerek reddediyordu. Zamanlanmış görev
-- kurulsaydı hangisinin çalışacağı belirsizdi; üstelik eskisi yanlış sayıyor.
drop function if exists public.calculate_monthly_org_commission();

create or replace function public.calculate_monthly_org_commission(
  p_year  int default null,
  p_month int default null
) returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  -- Varsayılan: TAMAMLANMIŞ ay (Türkiye takvimiyle).
  v_ref  date := (date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date - 1);
  v_yil  int; v_ay int;
  v_yeni int := 0; v_guncel int := 0; v_atlanan int := 0; v_etkilenen int;
  r record;
begin
  v_yil := coalesce(p_year, extract(year from v_ref)::int);
  v_ay  := coalesce(p_month, extract(month from v_ref)::int);

  if v_ay < 1 or v_ay > 12 then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_donem');
  end if;

  for r in
    select o.id as org_id, o.type,
           coalesce(
             o.created_by,
             (select m2.profile_id from public.members m2
               where m2.organization_id = o.id and m2.role = 'admin'
                 and m2.accepted_at is not null
               order by m2.joined_at nulls last, m2.created_at limit 1)
           ) as sahip,
           (select count(*) from public.members m3
             where m3.organization_id = o.id and m3.status = 'active'
               and m3.accepted_at is not null) as uye_sayisi,
           cr.uye_basi
      from public.organizations o
      join public.commission_rates cr on cr.org_type = o.type
  loop
    if r.sahip is null then
      v_atlanan := v_atlanan + 1;
      continue;
    end if;

    insert into public.organizational_commissions
      (organization_id, profile_id, period_month, period_year,
       member_count, commission_per_member, total_commission, status, calculated_at)
    values
      (r.org_id, r.sahip, v_ay, v_yil,
       r.uye_sayisi, r.uye_basi, r.uye_sayisi * r.uye_basi, 'pending', now())
    on conflict (organization_id, period_year, period_month) do update
      set member_count          = excluded.member_count,
          commission_per_member = excluded.commission_per_member,
          total_commission      = excluded.total_commission,
          profile_id            = excluded.profile_id,
          calculated_at         = now()
      where public.organizational_commissions.status = 'pending';

    get diagnostics v_etkilenen = row_count;
    if v_etkilenen > 0 then v_yeni := v_yeni + 1; else v_guncel := v_guncel + 1; end if;
  end loop;

  return jsonb_build_object('ok', true, 'yil', v_yil, 'ay', v_ay,
                            'yazilan', v_yeni, 'dokunulmayan', v_guncel,
                            'sahipsiz_atlanan', v_atlanan);
end;
$fn$;

revoke all on function public.calculate_monthly_org_commission(int, int) from public, anon, authenticated;
grant execute on function public.calculate_monthly_org_commission(int, int) to service_role;

-- Aylık zamanlama: ayın 1'inde 04:47 UTC (TR 07:47). Parametresiz çağrı bir
-- önceki ayı kapatır. Yeniden çalıştırmak güvenli.
--   select cron.schedule('qrtim-aylik-hakedis', '47 4 1 * *',
--                        'select public.calculate_monthly_org_commission(null, null)');
--
-- DOĞRULANDI (geri alınan işlemde): 10 kurum için satır yazıldı (önce 2 vardı
-- ve ikisi de 0 üye gösteriyordu) · üye sayıları gerçek · 'paid' işaretli
-- dönem yeniden hesaplamada korundu · sahibi olmayan 1 kurum atlandı.
--
-- AÇIK: "Türkiye Gençlik Derneği" (28.01.2026) kurucusu ve üyesi olmayan bir
-- yetim kayıt — eski atomik olmayan kurum oluşturma hatasının izi. Hakedişte
-- atlanıyor. Silmeden önce kullanıcıya sorulacak.
