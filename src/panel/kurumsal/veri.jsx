// KURUMSAL PANEL — veri yardımcıları (bileşen değil; yalnızca kanca ve sabitler)
//
// Bütün sayfalar aynı yükleme kancasını kullanır. Effect içinde senkron
// setState yapılmaz (react-hooks v7): "yükleniyor" durumu ayrı tutulmaz,
// son sonucun hangi yükleyiciye ve hangi sürüme ait olduğundan TÜRETİLİR.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { SITE_URL } from '../../lib/siteUrl'

// yukle: useCallback ile sabitlenmiş async fonksiyon (null → yükleme yok).
// Yükleyici değişince (ör. başka kurum seçildi) eski veri GÖSTERİLMEZ;
// yalnızca aynı yükleyici yenilenirken eski veri ekranda kalır (titreme olmasın).
export function useVeri(yukle) {
  const [surum, setSurum] = useState(0)
  const [durum, setDurum] = useState({ kaynak: null, surum: -1, veri: undefined, hata: null })

  useEffect(() => {
    if (!yukle) return undefined
    let iptal = false
    yukle().then(
      (veri) => { if (!iptal) setDurum({ kaynak: yukle, surum, veri, hata: null }) },
      (hata) => {
        console.error('Kurumsal panel verisi alınamadı:', hata)
        if (!iptal) setDurum({ kaynak: yukle, surum, veri: undefined, hata })
      },
    )
    return () => { iptal = true }
  }, [yukle, surum])

  const ayniKaynak = durum.kaynak === yukle
  return {
    veri: ayniKaynak ? durum.veri : undefined,
    hata: ayniKaynak ? durum.hata : null,
    yukleniyor: !!yukle && (!ayniKaynak || durum.surum !== surum),
    yenile: () => setSurum((s) => s + 1),
  }
}

// RPC çağrısı: hata fırlatır, veriyi döndürür.
export async function rpc(ad, govde) {
  const { data, error } = await supabase.rpc(ad, govde)
  if (error) throw error
  return data
}

// Herkese açık sayfa adresleri. Rota /org/:orgSlug/... ve sunucu
// (get_public_organization → resolve_organization_id) kurum kimliğini
// bekliyor; ayrı bir "slug" alanı yok, bu yüzden kimlik kullanılır.
export const kurumAdresi = (id, yol) => `${SITE_URL}/org/${id}/${yol}`
// Ekranda gösterim: "https://www." öneki gürültü.
export const kisaAdres = (adres) => String(adres || '').replace(/^https?:\/\/(www\.)?/, '')

export const TUR_AD = {
  company: 'Şirket',
  corporation: 'Holding',
  chamber: 'Esnaf odası',
  association: 'Dernek',
  dernek: 'Dernek',
  foundation: 'Vakıf',
  vakif: 'Vakıf',
  'vakıf': 'Vakıf',
  community: 'Topluluk',
  topluluk: 'Topluluk',
  union: 'Sendika',
  sendika: 'Sendika',
  stk: 'STK',
}
export const turAdi = (t) => TUR_AD[String(t || '').toLowerCase()] || t || 'Kurum'

export const PLAN_AD = {
  free: 'Başlangıç', student: 'Öğrenci', professional: 'Profesyonel',
  stk: 'STK Özel', business: 'Kurumsal', corporate: 'Kurumsal',
}

// Kurum baş harfleri: "Anadolu Yazılımcılar Derneği" → "AYD"
export function kurumKisa(ad) {
  const p = String(ad || '').trim().split(/\s+/).filter(Boolean)
  return (p.slice(0, 3).map((k) => k[0]).join('') || '?').toLocaleUpperCase('tr-TR')
}

// Dizin kararı sunucuyla aynı (get_public_org_members): STK türü +
// allowPublicDirectory + memberVisibility = public. Listelenen: aktif üyeler.
export function dizinAcikMi(kurum) {
  const a = kurum?.settings || {}
  return !!kurum?.is_stk && !!a.allowPublicDirectory && String(a.memberVisibility || '').toLowerCase() === 'public'
}

// "4 gün", "bugün", "dün" — liste sağındaki kısa yaş
export function kisaYas(d) {
  if (!d) return ''
  const gun = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (gun <= 0) return 'bugün'
  if (gun === 1) return 'dün'
  if (gun < 31) return `${gun} gün`
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export const gunOnce = (n) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

export const UYE_EKLEME_HATALARI = {
  yetkisiz: 'Bu kuruma davet göndermek için yönetici olmanız gerekiyor.',
  kullanici_bulunamadi: 'Bu e-posta adresiyle doğrulanmış bir QRtım hesabı bulunamadı. Kişinin önce hesap açıp e-postasını doğrulaması gerekiyor.',
  zaten_uye: 'Bu kişi zaten kurum üyesi.',
  davet_zaten_gonderildi: 'Bu kişiye davet zaten gönderilmiş, yanıtı bekleniyor.',
  cok_fazla_deneme: 'Çok fazla deneme yaptınız. Bir saat sonra tekrar deneyin.',
}

export const BASVURU_HATALARI = {
  yetkisiz: 'Bu başvuruyu sonuçlandırmak için kurum yöneticisi olmanız gerekiyor.',
  zaten_sonuclandi: 'Bu başvuru zaten sonuçlandırılmış.',
  basvuru_bulunamadi: 'Başvuru bulunamadı.',
  gecersiz_karar: 'Geçersiz karar.',
}

export const KURUM_HATALARI = {
  profil_yok: 'Profiliniz henüz hazır değil. Sayfayı yenileyip tekrar deneyin.',
  ad_zorunlu: 'Kurum adı zorunlu.',
  ayni_isim_var: 'Bu adla bir kurumunuz zaten var.',
  limit_asildi: 'Planınızın kurum sınırına ulaştınız.',
}

// Başvuruyu sonuçlandır: durum, profil eşleme ve üye ekleme sunucuda tek işlemde.
export async function basvuruSonuclandir(id, karar) {
  const data = await rpc('approve_application', { p_application_id: id, p_decision: karar })
  if (!data?.ok) throw new Error(BASVURU_HATALARI[data?.hata] || 'Başvuru güncellenemedi.')
  return data
}

// ---------------------------------------------------------------- üye işlemleri
// Tablo yazımında .select() şart: erişim kuralı engellediğinde Supabase hata
// DÖNDÜRMEZ, yalnızca 0 satır günceller. Etkilenen satır sayısına bakılmazsa
// yönetici olmayan kişiye "güncellendi" denirdi (MemberManager'daki ders).
export async function uyeleriGuncelle(idler, yama) {
  const { data, error } = await supabase.from('members').update(yama).in('id', idler).select('id')
  if (error) throw error
  return (data || []).length
}

export async function uyeleriCikar(idler) {
  const { data, error } = await supabase.from('members').delete().in('id', idler).select('id')
  if (error) throw error
  return (data || []).length
}

// Toplu ve tekli üye işlemleri: onay penceresi isteği üretir, sonucu bildirir.
// Kendi üyeliğiniz bu işlemlere hiç girmez (yanlışlıkla kendini düşürmesin).
export function uyeIslemleri({ onayIste, bildir, sonra }) {
  const ayikla = (uyeler) => uyeler.filter((u) => u.id && !u.is_me)
  const uygula = async (is, n, basari, eksik) => {
    try {
      const etkilenen = await is()
      if (etkilenen === 0) { bildir(eksik, 'error'); return }
      bildir(etkilenen < n ? `${basari} (${etkilenen}/${n}). ${eksik}` : basari, etkilenen < n ? 'error' : 'success')
    } catch (e) {
      bildir('İşlem yapılamadı: ' + e.message, 'error')
    } finally {
      sonra?.()
    }
  }
  const ad = (u) => (u.length === 1 ? u[0].name || 'Üye' : `${u.length} üye`)
  const kendiNotu = (once, sonra2) => (once.length !== sonra2.length ? '\n\nKendi üyeliğiniz bu işleme dahil edilmez.' : '')

  return {
    rol(uyeler, rol) {
      const u = ayikla(uyeler)
      if (!u.length) { bildir('Kendi rolünüzü buradan değiştiremezsiniz.', 'error'); return }
      onayIste({
        baslik: rol === 'admin' ? 'Yönetici yap' : 'Üye yap',
        mesaj: `${ad(u)} ${rol === 'admin' ? 'yönetici yapılacak. Yöneticiler üyeleri, başvuruları ve kurum ayarlarını yönetebilir.' : 'üye rolüne alınacak.'}${kendiNotu(uyeler, u)}`,
        onay: rol === 'admin' ? 'Yönetici yap' : 'Üye yap',
        onEvet: () => uygula(() => uyeleriGuncelle(u.map((x) => x.id), { role: rol }), u.length, 'Rol güncellendi.', 'Rol değiştirilemedi; yönetici olmanız gerekiyor ve son yönetici düşürülemez.'),
      })
    },
    durum(uyeler, durum) {
      const u = ayikla(uyeler).filter((x) => x.status !== 'invited')
      if (!u.length) { bildir('Seçimde durumu değiştirilebilecek üye yok.', 'error'); return }
      onayIste({
        baslik: durum === 'active' ? 'Etkinleştir' : 'Pasife al',
        mesaj: durum === 'active'
          ? `${ad(u)} yeniden aktif olacak.`
          : `${ad(u)} pasife alınacak. Pasif üyeler herkese açık üye dizininde listelenmez; üyelik kaydı silinmez.${kendiNotu(uyeler, u)}`,
        onay: durum === 'active' ? 'Etkinleştir' : 'Pasife al',
        onEvet: () => uygula(() => uyeleriGuncelle(u.map((x) => x.id), { status: durum }), u.length, 'Durum güncellendi.', 'Durum değiştirilemedi; bu işlem için yönetici olmanız gerekiyor.'),
      })
    },
    cikar(uyeler) {
      const u = ayikla(uyeler)
      if (!u.length) { bildir('Kendinizi buradan kurumdan çıkaramazsınız.', 'error'); return }
      onayIste({
        baslik: 'Kurumdan çıkar',
        mesaj: `${ad(u)} kurumdan çıkarılacak. Bu işlem geri alınamaz; yeniden üye olmak için davet ya da başvuru gerekir.${kendiNotu(uyeler, u)}`,
        onay: 'Kurumdan çıkar',
        tehlike: true,
        onEvet: () => uygula(() => uyeleriCikar(u.map((x) => x.id)), u.length, 'Üyelik sonlandırıldı.', 'Çıkarılamadı; yönetici olmanız gerekiyor ve son yönetici çıkarılamaz.'),
      })
    },
  }
}
