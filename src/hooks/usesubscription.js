import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useSubscription(profileId) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profileId) {
      console.log('❌ No profileId provided to useSubscription');
      setLoading(false);
      return;
    }

    console.log('🔍 Fetching subscription for profile_id:', profileId);

    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('profile_id', profileId)
          .eq('status', 'active')
          .single();

        if (error) {
          console.error('❌ Subscription fetch error:', error);
          setError(error.message);
        } else {
          console.log('✅ Subscription found:', data);
          setSubscription(data);
        }
      } catch (err) {
        console.error('❌ Subscription error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [profileId]);

  const getLimits = () => {
    if (!subscription) return null;

    const limits = {
  free: {
    organizations: 2,
    socialLinks: 3,
    nfcCards: 0,
    name: 'Başlangıç Planı'  // ✅ DEĞİŞTİ
  },
  professional: {
    organizations: 999,  // ✅ SINIRSIZ (15 → 999)
    socialLinks: 999,
    nfcCards: 1,  // Her türlü 1 kart
    name: 'Profesyonel Plan'  // ✅ DEĞİŞTİ
  },
  stk: {
    organizations: 999,
    socialLinks: 999,
    nfcCards: subscription.billing_cycle === 'yearly' ? 6 : 0,
    name: 'STK Özel Plan'  // ✅ DEĞİŞTİ
  },
  business: {  // ✅ corporate → business
    organizations: 999,
    socialLinks: 999,
    nfcCards: subscription.billing_cycle === 'yearly' ? 10 : 0,
    name: 'Kurumsal Plan'  // ✅ DEĞİŞTİ
  }
};

    return limits[subscription.plan] || limits.free;
  };

  const canAdd = (type) => {
    if (!subscription) return false;

    const limits = getLimits();
    if (!limits) return false;

    switch (type) {
      case 'organization':
        return subscription.organizations_used < limits.organizations;
      case 'socialLink':
        return subscription.organizations_used < limits.socialLinks;
      case 'nfcCard':
        return subscription.nfc_cards_used < limits.nfcCards;
      default:
        return false;
    }
  };

  const isPremium = () => {
    return subscription && subscription.plan !== 'free';
  };

  return {
    subscription,
    loading,
    error,
    getLimits,
    canAdd,
    isPremium
  };
}