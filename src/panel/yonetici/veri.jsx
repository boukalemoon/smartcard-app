// YÖNETİCİ PANELİ — veri yükleme, sabitler ve türetilmiş sayılar
//
// Sorgular eski AdminCRM ile aynı tablolardan gelir (profiles, subscriptions,
// commissions, referrals, plan_prices); yönetici okuma kuralları
// 20260917100000_privacy_lockdown.sql'de. Ek olarak yalnızca yöneticinin
// gerçekten okuyabildiği kaynaklar eklendi: organizations (org_read_scope),
// custom_domains (ozel_alan_adi), get_platform_stats ve kendi 2FA durumu.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export const SAYFA_BOYU = 50

export const TURLER = [
  { deger: 'users', ad: 'Kullanıcılar' },
  { deger: 'subs', ad: 'Abonelikler' },
  { deger: 'comms', ad: 'Komisyonlar' },
  { deger: 'refs', ad: 'Referanslar' },
]
const GUN = 24 * 60 * 60 * 1000

// Plan sırası tasarımdaki dağılım çubuğunun sırası. 'corporate' eski kayıtlarda
// geçiyor (admin_set_plan hâlâ kabul ediyor); Kurumsal ile aynı dilimde sayılır.
export const PLANLAR = [
  { deger: 'free', ad: 'Başlangıç', ton: 'notr', cubuk: 'bg-cizgi' },
  { deger: 'student', ad: 'Öğrenci', ton: 'notr', cubuk: 'bg-metin-2/50' },
  { deger: 'professional', ad: 'Profesyonel', ton: 'aksan', cubuk: 'bg-aksan' },
  { deger: 'stk', ad: 'STK Özel', ton: 'vurgu', cubuk: 'bg-vurgu' },
  { deger: 'business', ad: 'Kurumsal', ton: 'koyu', cubuk: 'bg-murekkep' },
]
export const planBul = (p) => PLANLAR.find((x) => x.deger === (p === 'corporate' ? 'business' : p))

export const ABONELIK_DURUM = {
  active: { ad: 'Aktif', ton: 'aksan' },
  paused: { ad: 'Askıda', ton: 'uyari' },
  cancelled: { ad: 'İptal edildi', ton: 'notr' },
  canceled: { ad: 'İptal edildi', ton: 'notr' },
  expired: { ad: 'Süresi doldu', ton: 'notr' },
  past_due: { ad: 'Ödeme gecikti', ton: 'uyari' },
  failed: { ad: 'Ödeme başarısız', ton: 'uyari' },
}
export const KOMISYON_DURUM = {
  pending: { ad: 'Onay bekliyor', ton: 'uyari' },
  approved: { ad: 'Onaylandı', ton: 'aksan' },
  paid: { ad: 'Ödendi', ton: 'olumlu' },
}
export const REFERANS_DURUM = {
  pending: { ad: 'Ödeme bekliyor', ton: 'notr' },
  active: { ad: 'Kazandırdı', ton: 'olumlu' },
  completed: { ad: 'Tamamlandı', ton: 'aksan' },
}
export const ROL_AD = { user: 'Kullanıcı', admin: 'Yönetici', superadmin: 'Süper yönetici' }
export const KURUM_TUR = {
  company: 'Şirket', corporation: 'Holding', association: 'Dernek',
  foundation: 'Vakıf', community: 'Topluluk', union: 'Birlik',
}

export const durumBul = (harita, d) => harita[d] || { ad: d || '—', ton: 'notr' }

// Bir aboneliğin süre içinde bitip bitmediği — ücretsiz ve süresiz olanlar bitmez.
export const yakindaBitiyor = (s, simdi) => {
  if (!s || s.plan === 'free' || !s.expires_at) return false
  const t = new Date(s.expires_at).getTime()
  return t > simdi && t - simdi < 7 * GUN
}

const BOS = {
  users: [], subs: [], comms: [], refs: [], orgs: [], fiyatlar: [], alanAdlari: [],
  platform: null, mfa: null, engelliler: {}, hatalar: [], zaman: 0,
}

// Tüm panel verisi tek seferde; her sorgunun hatası ayrı toplanır ki biri
// düşünce (ör. alan adı tablosu) diğer sayılar boş kalmasın.
async function getir() {
  const sonuc = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('*, profiles(name, email)').order('created_at', { ascending: false }),
    supabase.from('commissions').select('*, profiles(name, email)').order('created_at', { ascending: false }),
    supabase
      .from('referrals')
      .select('*, referrer:profiles!referrals_referrer_id_fkey(name, email), referee:profiles!referrals_referee_id_fkey(name, email)')
      .order('created_at', { ascending: false }),
    supabase.from('organizations').select('id, name, type, member_count, created_by, created_at').order('created_at', { ascending: false }),
    supabase.from('plan_prices').select('plan, period, with_nfc, amount_kurus').eq('is_active', true).eq('with_nfc', false),
    supabase.from('custom_domains').select('id, durum, created_at').eq('durum', 'beklemede'),
    supabase.rpc('get_platform_stats'),
    supabase.rpc('shieldauth_mfa_durumum'),
    // Engelli hesaplar: profile_id -> banned_until. auth.users istemciye
    // kapalı, bu yüzden RPC ile geliyor (profiles'a denormalize kolon YOK).
    supabase.rpc('admin_blocked_users'),
  ])
  const adlar = ['kullanıcılar', 'abonelikler', 'komisyonlar', 'referanslar', 'kurumlar', 'fiyatlar', 'alan adları', 'platform sayıları', '2FA durumu', 'engelli hesaplar']
  const hatalar = sonuc.map((r, i) => (r.error ? adlar[i] : null)).filter(Boolean)
  const [u, s, c, r, o, f, d, p, m, e] = sonuc.map((x) => x.data)
  return {
    users: u || [], subs: s || [], comms: c || [], refs: r || [], orgs: o || [],
    fiyatlar: f || [], alanAdlari: d || [], platform: p || null, mfa: m || null,
    engelliler: e || {},
    hatalar, zaman: Date.now(),
  }
}

export function useYoneticiVerisi() {
  const [veri, setVeri] = useState(BOS)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yenileniyor, setYenileniyor] = useState(false)

  useEffect(() => {
    let iptal = false
    getir()
      .then((v) => { if (!iptal) setVeri(v) })
      .finally(() => { if (!iptal) setYukleniyor(false) })
    return () => { iptal = true }
  }, [])

  const yenile = async () => {
    setYenileniyor(true)
    try {
      setVeri(await getir())
    } finally {
      setYenileniyor(false)
    }
  }

  return { veri, setVeri, yukleniyor, yenileniyor, yenile }
}

// Ekranda gösterilen her sayı buradan türer; yükleme anındaki saat (zaman)
// kullanılır ki "bu hafta", "7 gün" hesapları render'da saate bakmasın.
export function useTuretilmis(veri) {
  return useMemo(() => {
    const { users, subs, comms, orgs, fiyatlar, alanAdlari, platform, zaman } = veri

    // Kişi başına abonelik: en yenisi (liste created_at azalan geliyor).
    const abonelik = new Map()
    for (const s of subs) if (!abonelik.has(s.profile_id)) abonelik.set(s.profile_id, s)

    const kurulanKurum = new Map()
    for (const o of orgs) {
      if (!o.created_by) continue
      kurulanKurum.set(o.created_by, [...(kurulanKurum.get(o.created_by) || []), o])
    }
    const kisi = new Map(users.map((x) => [x.id, x]))

    const aktif = subs.filter((s) => s.status === 'active')
    const aktifUcretli = aktif.filter((s) => s.plan !== 'free')

    // Tutar plan_prices'tan (eski AdminCRM hesabı) ama dönem karışmasın diye
    // yıllığa çevrilir: aylık fiyat ×12, yıllık fiyat ×1. Fiyatı tabloda
    // olmayan abonelik tahminle doldurulmaz, ayrıca sayılır.
    let yillikTutar = 0
    let fiyatsiz = 0
    for (const s of aktifUcretli) {
      const donem = s.billing_cycle === 'yearly' ? 'yearly' : 'monthly'
      const f = fiyatlar.find((x) => x.plan === s.plan && x.period === donem)
      if (!f) { fiyatsiz += 1; continue }
      yillikTutar += (f.amount_kurus / 100) * (donem === 'monthly' ? 12 : 1)
    }

    const bekleyenKom = comms.filter((c) => c.status === 'pending' || c.status === 'approved')
    const bekleyenTutar = bekleyenKom.reduce((t, c) => t + parseFloat(c.amount || 0), 0)

    const dagilim = PLANLAR.map((p) => ({
      ...p,
      sayi: aktif.filter((s) => planBul(s.plan)?.deger === p.deger).length,
    }))

    const dikkat = [
      {
        anahtar: 'pasif',
        ad: 'Aktif olmayan abonelik',
        sayi: subs.filter((s) => s.status !== 'active').length,
        ton: 'tehlike',
        hedef: { tur: 'subs', durum: 'pasif' },
      },
      {
        anahtar: 'bitiyor',
        ad: 'Süresi 7 gün içinde dolacak ücretli abonelik',
        sayi: subs.filter((s) => yakindaBitiyor(s, zaman)).length,
        ton: 'uyari',
        hedef: { tur: 'subs', durum: 'bitiyor' },
      },
      {
        anahtar: 'komisyon',
        ad: 'Onay bekleyen komisyon',
        sayi: comms.filter((c) => c.status === 'pending').length,
        ton: 'uyari',
        hedef: { tur: 'comms', durum: 'pending' },
      },
      {
        anahtar: 'alan',
        ad: 'Alan adı bağlantısı 7+ gün bekleyen',
        sayi: alanAdlari.filter((a) => zaman - new Date(a.created_at).getTime() > 7 * GUN).length,
        ton: 'uyari',
        hedef: null,
      },
    ]

    return {
      abonelik, kurulanKurum, kisi,
      toplamKullanici: users.length,
      buHafta: users.filter((x) => zaman - new Date(x.created_at).getTime() < 7 * GUN).length,
      aktifUcretli: aktifUcretli.length,
      yillikTutar, fiyatsiz,
      bekleyenTutar, bekleyenSayi: bekleyenKom.length,
      nfcKart: platform?.nfc_kart ?? null,
      aktifSayi: aktif.length,
      dagilim, dikkat,
    }
  }, [veri])
}
