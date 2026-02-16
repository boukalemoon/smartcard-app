// src/utils/rateLimiting.js

/**
 * Client-side rate limiting
 * NOT: Bu sadece UI koruması, backend'de de rate limiting olmalı!
 */

class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  // Rate limit kontrolü
  check(key, maxRequests, windowMs) {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Eski istekleri temizle
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = windowMs - (now - oldestRequest);
      return {
        allowed: false,
        waitTime: Math.ceil(waitTime / 1000), // saniye
        message: `Çok fazla istek. ${Math.ceil(waitTime / 1000)} saniye bekleyin.`
      };
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return { allowed: true };
  }

  // Belirli bir key için limit'i temizle
  reset(key) {
    this.requests.delete(key);
  }

  // Tüm limit'leri temizle
  resetAll() {
    this.requests.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Kullanım örnekleri:

// Login için rate limiting (5 deneme / 15 dakika)
export const checkLoginRateLimit = (email) => {
  return rateLimiter.check(`login:${email}`, 5, 15 * 60 * 1000);
};

// Signup için rate limiting (3 kayıt / saat)
export const checkSignupRateLimit = (ip = 'client') => {
  return rateLimiter.check(`signup:${ip}`, 3, 60 * 60 * 1000);
};

// Profile update için rate limiting (10 güncelleme / dakika)
export const checkProfileUpdateRateLimit = (userId) => {
  return rateLimiter.check(`profile:${userId}`, 10, 60 * 1000);
};

// vCard download için rate limiting (5 indirme / dakika)
export const checkVCardDownloadRateLimit = (profileId) => {
  return rateLimiter.check(`vcard:${profileId}`, 5, 60 * 1000);
};

// Analytics tracking için rate limiting (30 event / dakika)
export const checkAnalyticsRateLimit = (profileId) => {
  return rateLimiter.check(`analytics:${profileId}`, 30, 60 * 1000);
};

// Referral code için rate limiting (3 deneme / saat)
export const checkReferralRateLimit = (code) => {
  return rateLimiter.check(`referral:${code}`, 3, 60 * 60 * 1000);
};

export default rateLimiter;