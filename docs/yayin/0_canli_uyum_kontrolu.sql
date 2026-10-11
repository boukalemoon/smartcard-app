-- Yeni web sürümünün çağırdığı veritabanı fonksiyonları ve tabloları canlıda var mı?
-- Sonuç BOŞ gelirse eksik yok. Satır gelirse o nesne eksik: main'e almadan önce bildirin.
select 'fonksiyon' as tur, x as eksik
from unnest(array['admin_delete_user','admin_set_plan','admin_set_role','appointment_set_status','appointment_settings_save','appointment_slots','approve_application','book_appointment','create_organization','custom_domain_claim','custom_domain_remove','get_or_create_referral_code','get_platform_stats','get_public_card','get_public_card_by_code','invitation_respond','leave_card_contact','my_activity','my_appointment_settings','my_appointments','my_calendar_key','my_card_analytics','my_card_contacts','my_custom_domains','my_link_performance','my_organizations','my_pending_invitations','my_plan_limits','my_referrals','my_verifications','org_activity_series','org_add_member_by_email','org_member_analytics','org_member_detail','org_member_list','payment_create_intent','payment_status','persona_editor','persona_list','resolve_custom_domain','rotate_calendar_key','shieldauth_mfa_durumum','track_card_event','verification_cancel','verification_start_domain']) x
where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = x)
union all
select 'tablo', x
from unnest(array['analytics_events','applications','card_contacts','commissions','members','organizations','persona_kinds','plan_prices','profile_payment','profiles','qrtim_user_ids','referral_codes','referrals','social_links','subscriptions']) x
where to_regclass('public.' || x) is null
order by 1, 2;
