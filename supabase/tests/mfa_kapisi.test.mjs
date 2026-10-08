import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// İKİ ADIMLI DOĞRULAMA KAPISI — veritabanı davranış testi (denetim G-01, G-02)
//
// Gerçek migration dosyalarını bellek içi bir PostgreSQL'e (PGlite) uygular ve
// Supabase'in JWT bağlamını (request.jwt.claims) taklit ederek kapının kimi
// geçirip kimi durdurduğunu sınar. Canlı veritabanına dokunmaz.
//
// Çalıştırma:  npm run test:sql
// Not: çekirdek tablolar (profiles, personas, ...) burada en küçük hâlleriyle
// taklit edilir; asıl şemaları depoda yok (denetim O-12).
const M = fileURLToPath(new URL('../migrations/', import.meta.url))
const db = new PGlite()
const run = (s) => db.exec(s)
await run(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema extensions;
create table auth.users (id uuid primary key, email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid, name text, role text default 'user', card_views int default 0, last_viewed_at timestamptz);
create table public.personas (id uuid primary key default gen_random_uuid(), profile_id uuid, title text, view_count int default 0, last_viewed_at timestamptz,
  baslik_buyuk text generated always as (upper(title)) stored);
create table public.organizations (id uuid primary key default gen_random_uuid(), name text, member_count int default 0);
create table public.members (id uuid primary key default gen_random_uuid(), organization_id uuid, name text);
create table public.social_links (id uuid primary key default gen_random_uuid(), profile_id uuid, url text);
create table public.profile_payment (profile_id uuid primary key, bank_accounts jsonb, billing_info jsonb);
`)
await run(fs.readFileSync(M + '20260929090000_shieldauth_mfa.sql', 'utf8'))
await run(fs.readFileSync(M + '20261008100000_mfa_yontem_ve_kimlik_yazma.sql', 'utf8'))
const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222'
const S1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', S2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
await run(`insert into auth.users values ('${U1}','a@x.com'),('${U2}','b@x.com');
insert into profiles (id,user_id,name) values ('${U1}','${U1}','Bir'),('${U2}','${U2}','Iki');
insert into social_links (profile_id,url) values ('${U1}','https://a.com');`)
const claims = async (o) => run(`select set_config('request.jwt.claims', '${o ? JSON.stringify(o) : ''}', false)`)
let pass = 0, fail = 0
async function t(name, fn, expectErr) {
  try { await fn(); if (expectErr) { fail++; console.log('FAIL (hata bekleniyordu):', name) } else { pass++; console.log('ok  ', name) } }
  catch (e) { if (expectErr && String(e.message).includes(expectErr)) { pass++; console.log('ok  ', name, '->', e.message) } else { fail++; console.log('FAIL', name, e.message) } }
}
const asU1 = () => claims({ role: 'authenticated', sub: U1, session_id: S1 })
const asU2 = () => claims({ role: 'authenticated', sub: U2, session_id: S2 })
const enroll = (u) => run(`insert into shieldauth_mfa_users values ('${u}', true, now()) on conflict (user_id) do update set totp_enrolled = true`)
const assert = (u, s, m, ago='1 minute') => run(`insert into shieldauth_mfa_assertions values ('${u}','${s}','${m}', now() - interval '${ago}') on conflict (user_id, session_id) do update set method = excluded.method, verified_at = excluded.verified_at`)

await asU1(); await t('TOTP kurmamis kullanici serbest yazar', () => run(`update profiles set name='Bir2' where user_id='${U1}'`))
await enroll(U1)
await t('TOTP kurmus, dogrulama yok -> red', () => run(`update profiles set name='X' where user_id='${U1}'`), 'mfa_required')
await t('INSERT de red', () => run(`insert into social_links (profile_id,url) values ('${U1}','https://b.com')`), 'mfa_required')
await t('DELETE de red', () => run(`delete from social_links where profile_id='${U1}'`), 'mfa_required')
await assert(U1, S1, 'email')
await t('G-02: e-posta kodu TOTP yerine gecmez', () => run(`update profiles set name='X' where user_id='${U1}'`), 'mfa_required')
await assert(U1, S1, 'totp')
await t('TOTP dogrulamasi sonrasi yazma serbest', () => run(`update profiles set name='Bir3' where user_id='${U1}'`))
await t('DELETE serbest (satir silinir)', async () => { await run(`delete from social_links where profile_id='${U1}'`); const r = await db.query(`select count(*)::int n from social_links`); if (r.rows[0].n !== 0) throw new Error('silinmedi') })
await assert(U1, S1, 'totp', '13 hours')
await t('12 saati gecen dogrulama -> red', () => run(`update profiles set name='X' where user_id='${U1}'`), 'mfa_required')
await assert(U1, S1, 'backup_code')
await t('Yedek kod gecerli', () => run(`update profiles set name='Bir4' where user_id='${U1}'`))
await claims({ role: 'authenticated', sub: U1, session_id: S2 })
await t('Baska oturumun dogrulamasi sayilmaz', () => run(`update profiles set name='X' where user_id='${U1}'`), 'mfa_required')
// ziyaretci senaryosu: U2 TOTP kurmus ama taze degil, U1'in sayacini artirir
await enroll(U2); await asU2()
await t('Sayac guncellemesi muaf (ziyaretci)', () => run(`update profiles set card_views = card_views + 1, last_viewed_at = now() where user_id='${U1}'`))
await claims(null); await run(`insert into personas (profile_id, title) values ('${U1}', 'Kart')`); await asU2()
await t('Uretilmis sutunlu tabloda sayac muafiyeti calisir', () => run(`update personas set view_count = view_count + 1, last_viewed_at = now() where profile_id='${U1}'`))
await t('Uretilmis sutunlu tabloda baslik degisimi red', () => run(`update personas set title = 'Sahte' where profile_id='${U1}'`), 'mfa_required')
await t('Sayacla birlikte ad degisirse red', () => run(`update profiles set card_views = card_views + 1, name='Y' where user_id='${U2}'`), 'mfa_required')
await claims({ role: 'service_role' })
await t('service_role muaf', () => run(`update profiles set name='Servis' where user_id='${U1}'`))
await claims(null)
await t('JWT yok (dogrudan baglanti) muaf', () => run(`update profiles set name='Db' where user_id='${U1}'`))
await claims({ role: 'anon' })
await t('anon muaf (tablo politikalari zaten engeller)', () => run(`update profiles set card_views = card_views + 1 where user_id='${U1}'`))
// fresh fonksiyonu: TOTP kurmamis kisi icin e-posta yeterli
await run(`delete from shieldauth_mfa_users where user_id='${U2}'`); await assert(U2, S2, 'email'); await asU2()
const r = await db.query(`select public.shieldauth_mfa_fresh(interval '10 minutes') f`)
await t('TOTP kurmamis kiside e-posta kodu taze sayilir', async () => { if (!r.rows[0].f) throw new Error('false') })
// odeme tetikleyicisi de yontem farkinda mi
await run(fs.readFileSync(M + '20260929091000_shieldauth_odeme_tetikleyici.sql', 'utf8'))
await enroll(U1); await run(`delete from shieldauth_mfa_assertions where user_id='${U1}'`); await assert(U1, S1, 'email'); await asU1()
await run(`grant all on profile_payment to authenticated; grant usage on schema auth to authenticated`)
await t('IBAN: TOTP kurmus kiside e-posta kodu yetmez', () => run(`set role authenticated; insert into profile_payment values ('${U1}', '[{"iban":"TR1"}]', null)`), 'mfa_required')
await run('reset role')
await assert(U1, S1, 'totp')
await t('IBAN: TOTP ile gecer', () => run(`set role authenticated; insert into profile_payment values ('${U1}', '[{"iban":"TR1"}]', null); reset role`))
// Güçlü doğrulama zayıfıyla ezilmez
await enroll(U1); await claims(null)
await assert(U1, S1, 'totp')
await assert(U1, S1, 'email')
const m = await db.query(`select method from shieldauth_mfa_assertions where user_id='${U1}' and session_id='${S1}'`)
await t('Taze TOTP kaydi e-posta ile ezilmez', async () => { if (m.rows[0].method !== 'totp') throw new Error(m.rows[0].method) })
await assert(U1, S1, 'totp', '13 hours'); await assert(U1, S1, 'email')
const m2 = await db.query(`select method from shieldauth_mfa_assertions where user_id='${U1}' and session_id='${S1}'`)
await t('Bayat TOTP kaydinin yerine yeni kayit yazilir', async () => { if (m2.rows[0].method !== 'email') throw new Error(m2.rows[0].method) })
// IBAN tetikleyicisi SECURITY DEFINER fonksiyon icinden de calisir
await run(`create function public.iban_yaz(p uuid) returns void language sql security definer as $$ update public.profile_payment set bank_accounts = '[{"iban":"TR2"}]' where profile_id = p $$`)
await asU1()
await t('IBAN: definer fonksiyon icinden de dogrulama ister', () => run(`select public.iban_yaz('${U1}')`), 'mfa_required')
console.log(`\n${pass} gecti, ${fail} kaldi`)
process.exit(fail ? 1 : 0)
