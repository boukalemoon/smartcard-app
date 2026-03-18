import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const DEFAULT_FREE_SUBSCRIPTION = {
  plan: 'free',
  status: 'active',
  organizations_limit: 2,
  social_links_limit: 3,
  nfc_cards_included: 0,
  nfc_cards_used: 0,
  organizations_used: 0,
  social_links_used: 0,
  billing_cycle: null
};

export function useSubscription(profileId) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      return;
    }

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
          // Kayıt bulunamazsa free plan varsayılan olarak set et
          console.warn('Subscription not found, defaulting to free:', error.message);
          setSubscription(DEFAULT_FREE_SUBSCRIPTION);
        } else {
          setSubscription(data);
        }
      } catch (err) {
        console.error('Subscription error:', err);
        setSubscription(DEFAULT_FREE_SUBSCRIPTION);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [profileId]);

  const getLimits = () => {
    if (!subscription) return {
      organizations: 2,
      socialLinks: 3,
      nfcCards: 0,
      name: 'Başlangıç Planı'
    };

    const limits = {
      free: {
        organizations: 2,
        socialLinks: 3,
        nfcCards: 0,
        name: 'Başlangıç Planı'
      },
      professional: {
        organizations: 999,
        socialLinks: 999,
        nfcCards: subscription.billing_cycle === 'yearly' ? 1 : 0,
        name: 'Profesyonel Plan'
      },
      stk: {
        organizations: 999,
        socialLinks: 999,
        nfcCards: subscription.billing_cycle === 'yearly' ? 6 : 0,
        name: 'STK Özel Plan'
      },
      business: {
        organizations: 999,
        socialLinks: 999,
        nfcCards: subscription.billing_cycle === 'yearly' ? 10 : 0,
        name: 'Kurumsal Plan'
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
        return (subscription.organizations_used || 0) < limits.organizations;
      case 'socialLink':
        return (subscription.social_links_used || 0) < limits.socialLinks;
      case 'nfcCard':
        return (subscription.nfc_cards_used || 0) < limits.nfcCards;
      default:
        return false;
    }
  };

  const isPremium = () => {
    return subscription && subscription.plan !== 'free';
  };

  return { subscription, loading, error, getLimits, canAdd, isPremium };
}