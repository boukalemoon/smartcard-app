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
      .from('analytics_summary')
      .select('*')
      .eq('profile_id', profileId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return data || {
      profile_views: 0,
      qr_scans: 0,
      nfc_taps: 0,
      vcard_downloads: 0,
      link_clicks: 0,
      last_activity: null
    }
  } catch (error) {
    console.error('Get analytics summary error:', error)
    return null
  }
}

/**
 * Get recent analytics events
 */
export const getRecentEvents = async (profileId, limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Get recent events error:', error)
    return []
  }
}