-- ============================================================================
-- EKSİK FONKSİYON GÖVDELERİ
-- ============================================================================
--
-- NEDEN: üç göç dosyası (ozel_alan_adi, randevu, randevu_takvim_beslemesi)
-- fonksiyon gövdelerini içermek yerine "gövdeleri Supabase göç geçmişinde"
-- diyen bir not taşıyordu. Bu, depodan sıfırdan kurulumda o fonksiyonların
-- HİÇ oluşmaması demek — üretimle depo birbirini tutmuyordu.
--
-- Bunu commit öncesi kapı yakaladı (scripts/kontrol.mjs, "Göç dosyaları"
-- kontrolü). Aynı hatayı bir kez daha yapmıştım ve o sefer elle fark
-- etmiştim; bu sefer mekanizma buldu.
--
-- Gövdeler üretimden pg_get_functiondef ile alındı, elle yazılmadı.

-- ---------------------------------------------------------------------------
-- Özel alan adı
-- ---------------------------------------------------------------------------
create or replace function public.custom_domain_mark(
  p_id uuid, p_durum text, p_saglayici jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;
  if p_durum not in ('beklemede','baglandi','hata') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_durum');
  end if;

  update public.custom_domains
     set durum = p_durum,
         saglayici = coalesce(p_saglayici, '{}'::jsonb),
         baglandi_at = case when p_durum = 'baglandi' then now() else baglandi_at end,
         updated_at = now()
   where id = p_id and durum <> 'iptal';

  return jsonb_build_object('ok', found);
end;
$fn$;

revoke all on function public.custom_domain_mark(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.custom_domain_mark(uuid, text, jsonb) to service_role;

create or replace function public.custom_domain_remove(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_prof uuid := public.my_profile_id(); v_host text;
begin
  update public.custom_domains
     set durum = 'iptal', updated_at = now()
   where id = p_id and profile_id = v_prof
   returning host into v_host;

  if v_host is null then
    return jsonb_build_object('ok', false, 'hata', 'kayit_yok');
  end if;

  perform public.log_event('custom_domain.removed', auth.uid(), 'qrtim',
                           'custom_domain', p_id::text, 'success', 'notice', 'user',
                           jsonb_build_object('host', v_host),
                           'user', null, public.request_client_ip(), null, auth.uid());
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.custom_domain_remove(uuid) from public, anon;
grant execute on function public.custom_domain_remove(uuid) to authenticated;

create or replace function public.my_custom_domains()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'host', d.host, 'durum', d.durum,
           'persona_id', d.persona_id,
           'kart_adi', coalesce(x.display_name, x.name),
           'baglandi_at', d.baglandi_at,
           'created_at', d.created_at) order by d.created_at desc), '[]'::jsonb)
    from public.custom_domains d
    left join public.personas x on x.id = d.persona_id
   where d.profile_id = public.my_profile_id() and d.durum <> 'iptal';
$fn$;

revoke all on function public.my_custom_domains() from public, anon;
grant execute on function public.my_custom_domains() to authenticated;

-- ---------------------------------------------------------------------------
-- Randevu — panel tarafı
-- ---------------------------------------------------------------------------
create or replace function public.my_appointment_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_prof uuid := public.my_profile_id(); v_a public.appointment_settings;
begin
  if v_prof is null then return jsonb_build_object('ok', false, 'hata', 'profil_yok'); end if;
  select * into v_a from public.appointment_settings where profile_id = v_prof;
  return jsonb_build_object('ok', true,
    'aktif', coalesce(v_a.aktif, false),
    'slot_dakika', coalesce(v_a.slot_dakika, 30),
    'ileri_gun', coalesce(v_a.ileri_gun, 14),
    'en_erken_saat', coalesce(v_a.en_erken_saat, 2),
    'gun_saatleri', coalesce(v_a.gun_saatleri, '{}'::jsonb),
    'aciklama', v_a.aciklama,
    'otomatik_onay', coalesce(v_a.otomatik_onay, false));
end;
$fn$;

revoke all on function public.my_appointment_settings() from public, anon;
grant execute on function public.my_appointment_settings() to authenticated;

create or replace function public.my_appointments(p_gecmis boolean default false)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'baslar_at', a.baslar_at, 'biter_at', a.biter_at,
           'ad', a.ad, 'eposta', a.eposta, 'telefon', a.telefon,
           'aciklama', a.aciklama, 'kaynak', a.kaynak, 'durum', a.durum,
           'created_at', a.created_at)
           order by a.baslar_at), '[]'::jsonb)
    from public.appointments a
   where a.profile_id = public.my_profile_id()
     and (case when p_gecmis then a.baslar_at < now() else a.baslar_at >= now() end);
$fn$;

revoke all on function public.my_appointments(boolean) from public, anon;
grant execute on function public.my_appointments(boolean) to authenticated;

create or replace function public.appointment_set_status(p_id uuid, p_durum text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_prof uuid := public.my_profile_id();
begin
  if p_durum not in ('onaylandi','iptal','tamamlandi') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_durum');
  end if;
  update public.appointments
     set durum = p_durum, updated_at = now()
   where id = p_id and profile_id = v_prof;
  if not found then return jsonb_build_object('ok', false, 'hata', 'kayit_yok'); end if;

  perform public.log_event('appointment.status', auth.uid(), 'qrtim', 'appointment', p_id::text,
                           'success', 'notice', 'user', jsonb_build_object('durum', p_durum),
                           'user', null, public.request_client_ip(), null, auth.uid());
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.appointment_set_status(uuid, text) from public, anon;
grant execute on function public.appointment_set_status(uuid, text) to authenticated;

-- Randevuyu alan kişinin hesabı yok; kendi randevusunu bu kodla iptal eder.
create or replace function public.appointment_cancel_by_code(p_id uuid, p_kod text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.check_rate_limit('randevu-iptal:' || public.request_client_ip(), 10, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;
  update public.appointments
     set durum = 'iptal', updated_at = now()
   where id = p_id and iptal_kodu = p_kod and durum in ('bekliyor','onaylandi');
  if not found then return jsonb_build_object('ok', false, 'hata', 'kayit_yok'); end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.appointment_cancel_by_code(uuid, text) from public;
grant execute on function public.appointment_cancel_by_code(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Takvim anahtarı
-- ---------------------------------------------------------------------------
create or replace function public.my_calendar_key()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('ok', true, 'anahtar', s.takvim_anahtari)
    from public.appointment_settings s
   where s.profile_id = public.my_profile_id();
$fn$;

revoke all on function public.my_calendar_key() from public, anon;
grant execute on function public.my_calendar_key() to authenticated;

create or replace function public.rotate_calendar_key()
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_prof uuid := public.my_profile_id(); v_yeni text;
begin
  if v_prof is null then return jsonb_build_object('ok', false, 'hata', 'profil_yok'); end if;

  v_yeni := encode(extensions.gen_random_bytes(16), 'hex');
  update public.appointment_settings
     set takvim_anahtari = v_yeni, updated_at = now()
   where profile_id = v_prof;
  if not found then return jsonb_build_object('ok', false, 'hata', 'randevu_ayari_yok'); end if;

  perform public.log_event('appointment.calendar_key_rotated', auth.uid(), 'qrtim',
                           'appointment_settings', v_prof::text,
                           'success', 'notice', 'user', '{}'::jsonb,
                           'user', null, public.request_client_ip(), null, auth.uid());

  return jsonb_build_object('ok', true, 'anahtar', v_yeni);
end;
$fn$;

revoke all on function public.rotate_calendar_key() from public, anon;
grant execute on function public.rotate_calendar_key() to authenticated;
