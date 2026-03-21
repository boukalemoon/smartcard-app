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
  if (!subscription) {
    return { organizations: 2, socialLinks: 3, nfcCards: 0, name: 'Başlangıç Planı' }
  }

  const isYearly = subscription.billing_cycle === 'yearly'

  if (subscription.plan === 'student') {
    return {
      organizations: 1,
      socialLinks: 5,
      nfcCards: isYearly ? 1 : 0,
      name: 'Öğrenci Planı'
    }
  }

  if (subscription.plan === 'professional') {
    return {
      organizations: 999,
      socialLinks: 999,
      nfcCards: isYearly ? 1 : 0,
      name: 'Profesyonel Plan'
    }
  }

  if (subscription.plan === 'stk') {
    return {
      organizations: 999,
      socialLinks: 999,
      nfcCards: isYearly ? 6 : 0,
      name: 'STK Özel Plan'
    }
  }

  if (subscription.plan === 'business') {
    return {
      organizations: 999,
      socialLinks: 999,
      nfcCards: isYearly ? 10 : 0,
      name: 'Kurumsal Plan'
    }
  }

  return { organizations: 2, socialLinks: 3, nfcCards: 0, name: 'Başlangıç Planı' }
}

  const canAdd = (type) => {
    if (!subscription) return false;
    const limits = getLimits();
    if (!limits) return false;

    if (type === 'organization') {
      return (subscription.organizations_used || 0) < limits.organizations;
    }
    if (type === 'socialLink') {
      return (subscription.social_links_used || 0) < limits.socialLinks;
    }
    if (type === 'nfcCard') {
      return (subscription.nfc_cards_used || 0) < limits.nfcCards;
    }
    return false;
  };

  const isPremium = () => {
    return subscription && subscription.plan !== 'free';
  };

  return { subscription, loading, error, getLimits, canAdd, isPremium };
}