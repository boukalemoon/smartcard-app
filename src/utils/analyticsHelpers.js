import { supabase } from '../lib/supabaseClient'

/**
 * Track analytics event
 * @param {string} profileId - Profile ID to track
 * @param {string} eventType - Event type (profile_view, qr_scan, nfc_tap, vcard_download, link_click)
 * @param {object} metadata - Additional metadata (optional)
 */
export const trackEvent = async (profileId, eventType, metadata = {}) => {
  try {
    // IP ve User Agent bilgilerini al
    const userAgent = navigator.userAgent
    const referrer = document.referrer || 'direct'

    await supabase
      .from('analytics_events')
      .insert({
        profile_id: profileId,
        event_type: eventType,
        metadata,
        user_agent: userAgent,
        referrer: referrer
      })

    console.log(`📊 Analytics tracked: ${eventType} for profile ${profileId}`)
  } catch (error) {
    console.error('Analytics tracking error:', error)
    // Hata olsa bile kullanıcıyı etkilemesin
  }
}

/**
 * Get analytics summary for a profile
 */
export const getAnalyticsSummary = async (profileId) => {
  try {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type')
      .eq('profile_id', profileId)

    if (error) throw error

    const summary = {
      profile_views: 0,
      qr_scans: 0,
      vcard_downloads: 0,
      link_clicks: 0
    }

    data?.forEach(event => {
      if (event.event_type === 'profile_view') summary.profile_views++
      if (event.event_type === 'qr_scan') summary.qr_scans++
      if (event.event_type === 'vcard_download') summary.vcard_downloads++
      if (event.event_type === 'link_click') summary.link_clicks++
    })

    return summary
  } catch (error) {
    console.error('Get analytics summary error:', error)
    return { profile_views: 0, qr_scans: 0, vcard_downloads: 0, link_clicks: 0 }
  }
}

/**
 * Get analytics summary with date filter
 */
export const getAnalyticsSummaryFiltered = async (profileId, filter = null) => {
  try {
    let query = supabase
      .from('analytics_events')
      .select('event_type')
      .eq('profile_id', profileId)

    if (filter) {
      if (filter.type === 'monthly') {
        const start = new Date(filter.year, filter.month - 1, 1).toISOString()
        const end = new Date(filter.year, filter.month, 0, 23, 59, 59).toISOString()
        query = query.gte('created_at', start).lte('created_at', end)
      } else if (filter.type === 'yearly') {
        const start = new Date(filter.year, 0, 1).toISOString()
        const end = new Date(filter.year, 11, 31, 23, 59, 59).toISOString()
        query = query.gte('created_at', start).lte('created_at', end)
      } else if (filter.type === 'range') {
        query = query
          .gte('created_at', filter.startDate)
          .lte('created_at', filter.endDate + 'T23:59:59')
      }
    }

    if (error) throw error

    const summary = {
      profile_views: 0,
      qr_scans: 0,
      vcard_downloads: 0,
      link_clicks: 0
    }

    data?.forEach(event => {
      if (event.event_type === 'profile_view') summary.profile_views++
      if (event.event_type === 'qr_scan') summary.qr_scans++
      if (event.event_type === 'vcard_download') summary.vcard_downloads++
      if (event.event_type === 'link_click') summary.link_clicks++
    })

    return summary
  } catch (error) {
    console.error('Filtered analytics error:', error)
    return { profile_views: 0, qr_scans: 0, vcard_downloads: 0, link_clicks: 0 }
  }
}