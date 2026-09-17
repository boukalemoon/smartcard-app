import { supabase } from '../lib/supabaseClient'

// KART HAREKETLERİ
//
// NEDEN RPC: Olaylar eskiden tarayıcıdan doğrudan analytics_events tablosuna
// yazılıyordu ve tabloda "herkes her satırı yazabilir" kuralı vardı. Yani
// giriş yapmamış biri, istediği kişi adına istediği kadar görüntülenme
// üretebiliyordu. Üyeleri bu sayılara göre kıyaslayacaksak bu kabul edilemez.
// Artık tek yol track_card_event: hız sınırı, profil çözümü ve sahiplik
// kontrolü sunucuda.
//
// KAYNAK (source): Kartın kendisi her zaman 'profile_view' yazar; ziyaretçinin
// karta NEREDEN geldiği ayrı alanda tutulur:
//   qr     → QR kod okutuldu     (adreste ?k=qr)
//   nfc    → NFC kart okutuldu   (adreste ?k=nfc)
//   link   → paylaşılan /k/<kod> bağlantısı
//   direct → adres doğrudan açıldı
// Daha önce basılmış kartlarda bu işaret yok; onlar 'direct' görünür.

export const KAYNAK_PARAMETRESI = 'k'

/** Adresteki ?k=... değerinden ziyaretçinin geliş kaynağını çıkarır. */
export function kaynagiCoz(search, koduVarMi = false) {
  const p = new URLSearchParams(search || '')
  const k = (p.get(KAYNAK_PARAMETRESI) || '').toLowerCase()
  if (k === 'qr' || k === 'nfc') return k
  return koduVarMi ? 'link' : 'direct'
}

/**
 * Kart hareketini kaydeder. Hata kullanıcıya yansıtılmaz ama sessizce de
 * yutulmaz; geliştirici konsolunda görünür.
 *
 * @param {'profile_view'|'vcard_download'|'link_click'|'share'} eventType
 * @param {{username?: string, code?: string, source?: string, meta?: object}} hedef
 */
export const trackCardEvent = async (eventType, hedef = {}) => {
  const { username = null, code = null, source = null, meta = {} } = hedef
  if (!username && !code) return
  try {
    const { error } = await supabase.rpc('track_card_event', {
      p_event: eventType,
      p_username: username,
      p_code: code,
      p_source: source,
      p_meta: meta,
    })
    if (error) throw error
  } catch (error) {
    console.error('Hareket kaydedilemedi:', eventType, error)
  }
}

/**
 * Dönem seçimini sunucunun beklediği tarih aralığına çevirir.
 * Sunucu tarafı günün tamamını kapsar; bitiş günü rapora dahildir.
 * @returns {{from: string|null, to: string|null}}
 */
export function filtreyiAraligaCevir(filter) {
  if (!filter) return { from: null, to: null }
  if (filter.type === 'monthly') {
    return {
      from: new Date(filter.year, filter.month - 1, 1).toISOString(),
      to: new Date(filter.year, filter.month, 0).toISOString(),
    }
  }
  if (filter.type === 'yearly') {
    return {
      from: new Date(filter.year, 0, 1).toISOString(),
      to: new Date(filter.year, 11, 31).toISOString(),
    }
  }
  if (filter.type === 'range' && filter.startDate && filter.endDate) {
    return {
      from: new Date(filter.startDate).toISOString(),
      to: new Date(filter.endDate).toISOString(),
    }
  }
  return { from: null, to: null }
}

/**
 * Kişinin kendi kartının özeti. Kendi olaylarını okuyabilir (RLS).
 * @param {string} profileId
 * @param {{type: 'monthly'|'yearly'|'range', year?: number, month?: number, startDate?: string, endDate?: string}} [filter]
 */
export const getAnalyticsSummary = async (profileId, filter = null) => {
  const bos = {
    profile_views: 0, qr_views: 0, nfc_views: 0, link_views: 0, direct_views: 0,
    vcard_downloads: 0, link_clicks: 0, shares: 0,
  }
  if (!profileId) return bos

  try {
    let query = supabase
      .from('analytics_events')
      .select('event_type, source')
      .eq('profile_id', profileId)

    // Eskiden bu filtre kuruluyor ama sorgu hiç çalıştırılmıyordu; fonksiyon
    // her zaman sıfır döndürüyordu (bulgu: "dönem seçimi hiçbir şeyi değiştirmiyor").
    if (filter?.type === 'monthly') {
      query = query
        .gte('created_at', new Date(filter.year, filter.month - 1, 1).toISOString())
        .lt('created_at', new Date(filter.year, filter.month, 1).toISOString())
    } else if (filter?.type === 'yearly') {
      query = query
        .gte('created_at', new Date(filter.year, 0, 1).toISOString())
        .lt('created_at', new Date(filter.year + 1, 0, 1).toISOString())
    } else if (filter?.type === 'range' && filter.startDate && filter.endDate) {
      const bitis = new Date(filter.endDate)
      bitis.setDate(bitis.getDate() + 1) // bitiş günü dahil olsun
      query = query
        .gte('created_at', new Date(filter.startDate).toISOString())
        .lt('created_at', bitis.toISOString())
    }

    const { data, error } = await query
    if (error) throw error

    const ozet = { ...bos }
    for (const olay of data || []) {
      const goruntulenme = ['profile_view', 'qr_scan', 'nfc_tap'].includes(olay.event_type)
      if (goruntulenme) {
        ozet.profile_views++
        const kaynak = olay.source || (olay.event_type === 'qr_scan' ? 'qr' : olay.event_type === 'nfc_tap' ? 'nfc' : 'direct')
        if (kaynak === 'qr') ozet.qr_views++
        else if (kaynak === 'nfc') ozet.nfc_views++
        else if (kaynak === 'link') ozet.link_views++
        else ozet.direct_views++
      }
      if (olay.event_type === 'vcard_download') ozet.vcard_downloads++
      if (olay.event_type === 'link_click') ozet.link_clicks++
      if (olay.event_type === 'share') ozet.shares++
    }
    return ozet
  } catch (error) {
    console.error('Özet alınamadı:', error)
    return bos
  }
}
